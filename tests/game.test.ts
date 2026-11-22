import { describe, expect, it } from 'vitest';
import {
  applyAction,
  buildPots,
  createGame,
  getLegalActions,
  startHand,
  type GameState,
  type SeatConfig,
} from '../src/engine/game';
import { randInt, seededRng } from '../src/engine/random';

function seats(stacks: number[]): SeatConfig[] {
  return stacks.map((stack, i) => ({ id: `p${i}`, name: `J${i}`, isHuman: i === 0, profile: null, stack }));
}

const total = (s: GameState) => s.players.reduce((a, p) => a + p.stack + p.contributed, 0);
const stacksOnly = (s: GameState) => s.players.reduce((a, p) => a + p.stack, 0);

describe('déroulé d’une main', () => {
  it('tête-à-tête : le bouton paie la SB et parle en premier préflop, en second ensuite', () => {
    let s = createGame(seats([1000, 1000]));
    s = { ...s, button: 1 }; // le prochain bouton sera le joueur 0
    s = startHand(s, seededRng(1));
    expect(s.button).toBe(0);
    expect(s.sbIndex).toBe(0);
    expect(s.bbIndex).toBe(1);
    expect(s.toAct).toBe(0);
    s = applyAction(s, { type: 'call' });
    expect(s.toAct).toBe(1); // option de la BB
    expect(getLegalActions(s)!.canRaise).toBe(true);
    s = applyAction(s, { type: 'check' });
    expect(s.street).toBe('flop');
    expect(s.board).toHaveLength(3);
    expect(s.toAct).toBe(1);
  });

  it('tout le monde se couche : la BB remporte les blinds', () => {
    let s = createGame(seats([1000, 1000, 1000]));
    s = { ...s, button: 2 };
    s = startHand(s, seededRng(2)); // bouton 0, SB 1, BB 2
    expect(s.toAct).toBe(0);
    s = applyAction(s, { type: 'fold' });
    s = applyAction(s, { type: 'fold' });
    expect(s.result).not.toBeNull();
    expect(s.players[2].stack).toBe(1005);
    expect(s.players[1].stack).toBe(995);
    expect(s.result!.net).toEqual([0, -5, 5]);
  });

  it('applique la relance minimale', () => {
    let s = createGame(seats([1000, 1000, 1000, 1000]));
    s = { ...s, button: 3 };
    s = startHand(s, seededRng(3)); // bouton 0, SB 1, BB 2, UTG 3
    expect(s.toAct).toBe(3);
    expect(getLegalActions(s)!.minRaiseTo).toBe(20);
    s = applyAction(s, { type: 'raise', amount: 30 });
    expect(getLegalActions(s)!.minRaiseTo).toBe(50);
    s = applyAction(s, { type: 'raise', amount: 12 }); // trop petit : ramené au minimum
    expect(s.players[0].bet).toBe(50);
  });

  it('un tapis inférieur à la relance minimale ne rouvre pas les enchères', () => {
    let s = createGame(seats([1000, 1000, 1000, 75]));
    s = { ...s, button: 2 };
    s = startHand(s, seededRng(4)); // bouton 3 (75), SB 0, BB 1, UTG 2
    expect(s.toAct).toBe(2);
    s = applyAction(s, { type: 'raise', amount: 50 }); // UTG relance à 50
    expect(s.toAct).toBe(3);
    s = applyAction(s, { type: 'raise', amount: 75 }); // tapis 75 : +25 < 40
    s = applyAction(s, { type: 'fold' }); // SB
    s = applyAction(s, { type: 'fold' }); // BB
    expect(s.toAct).toBe(2);
    const legal = getLegalActions(s)!;
    expect(legal.toCall).toBe(25);
    expect(legal.canRaise).toBe(false);
  });

  it('construit les pots annexes', () => {
    const pots = buildPots([
      { contributed: 100, folded: false, sittingOut: false },
      { contributed: 300, folded: false, sittingOut: false },
      { contributed: 300, folded: false, sittingOut: false },
      { contributed: 50, folded: true, sittingOut: false },
    ]);
    expect(pots).toEqual([
      { amount: 350, eligible: [0, 1, 2] },
      { amount: 400, eligible: [1, 2] },
    ]);
  });

  it('tapis multiples : les jetons sont conservés et redistribués', () => {
    let s = createGame(seats([100, 300, 600]));
    s = { ...s, button: 2 };
    s = startHand(s, seededRng(5));
    while (!s.result) {
      const legal = getLegalActions(s)!;
      s = legal.canRaise ? applyAction(s, { type: 'raise', amount: legal.maxRaiseTo }) : applyAction(s, { type: 'call' });
    }
    expect(stacksOnly(s)).toBe(1000);
    expect(s.result!.showdown).toBe(true);
    expect(s.board).toHaveLength(5);
    expect(s.result!.net.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('simulation aléatoire : jamais bloqué, jetons conservés', () => {
    const rng = seededRng(42);
    for (let game = 0; game < 40; game++) {
      const n = 2 + (game % 5);
      let s = createGame(seats(Array.from({ length: n }, () => 200 + randInt(rng, 800))));
      const chips = total(s);
      for (let hand = 0; hand < 60; hand++) {
        if (s.players.filter((p) => p.stack > 0).length < 2) break;
        s = startHand(s, rng);
        let guard = 0;
        while (!s.result) {
          expect(total(s)).toBe(chips);
          const legal = getLegalActions(s)!;
          expect(legal).not.toBeNull();
          const r = rng();
          if (r < 0.15 && legal.toCall > 0) s = applyAction(s, { type: 'fold' });
          else if (r < 0.35 && legal.canRaise) {
            const amt = legal.minRaiseTo + randInt(rng, legal.maxRaiseTo - legal.minRaiseTo + 1);
            s = applyAction(s, { type: 'raise', amount: amt });
          } else s = applyAction(s, { type: legal.toCall > 0 ? 'call' : 'check' });
          if (++guard > 200) throw new Error('Main bloquée');
        }
        expect(stacksOnly(s)).toBe(chips);
        expect(s.players.every((p) => p.stack >= 0)).toBe(true);
      }
    }
  });
});
