import { describe, expect, it } from 'vitest';
import { decideBot } from '../src/engine/bot';
import { getSession, newTable, nextHand, botAct } from '../src/views/play/session';

/** Joue une partie complète, le joueur humain étant piloté par la logique d'un bot. */
function playOut(opponents: number, startingBB: number) {
  newTable({ opponents, startingBB, profiles: 'mix' });
  const total = getSession().game!.players.reduce((a, p) => a + p.stack + p.contributed, 0);
  for (let guard = 0; guard < 50000 && !getSession().over; guard++) {
    const g = getSession().game!;
    if (g.result) nextHand();
    else botAct(decideBot(g));
    const now = getSession().game!;
    // Main finie : les gains sont dans les tapis ; main en cours : tapis + jetons engagés.
    const chips = now.players.reduce((a, p) => a + p.stack + (now.result ? 0 : p.contributed), 0);
    expect(chips).toBe(total);
  }
  return { s: getSession(), total };
}

describe('partie sans recave', () => {
  it('se termine par une élimination ou une victoire, sans remise de jetons', () => {
    for (let round = 0; round < 6; round++) {
      const { s, total } = playOut(1 + (round % 5), 15);
      expect(s.over).not.toBeNull();
      const players = s.game!.players;
      // Aucun joueur n'a été remplacé ni recavé : mêmes sièges, total de jetons inchangé.
      expect(players).toHaveLength(1 + (1 + (round % 5)));
      expect(players.reduce((a, p) => a + p.stack, 0)).toBe(total);
      const places = s.eliminations.map((e) => e.place);
      expect(new Set(places).size).toBe(places.length);
      if (s.over!.won) {
        expect(players.find((p) => p.isHuman)!.stack).toBe(total);
        expect(s.eliminations).toHaveLength(players.length - 1);
      } else {
        expect(players.find((p) => p.isHuman)!.stack).toBe(0);
        expect(s.eliminations.find((e) => e.isHuman)?.place).toBe(s.over!.place);
      }
      // Une partie terminée ne repart pas.
      const hand = s.game!.handNumber;
      nextHand();
      expect(getSession().game!.handNumber).toBe(hand);
    }
  });
});
