import { describe, expect, it } from 'vitest';
import { decideBot } from '../src/engine/bot';
import { parseCards } from '../src/engine/cards';
import { getAdvice, gradeDecision } from '../src/engine/coach';
import { applyAction, createGame, getLegalActions, startHand, type SeatConfig } from '../src/engine/game';
import { drawOuts, hitProbability, improvementOuts, requiredEquity } from '../src/engine/outs';
import { seededRng } from '../src/engine/random';
import {
  generateDrawSpot,
  generateEquity,
  generateOuts,
  generatePotOdds,
  generatePreflop,
  generateWinner,
} from '../src/trainers/generators';

describe('outs', () => {
  it('compte les tirages classiques', () => {
    expect(drawOuts(parseCards('Ah5h'), parseCards('Kh8h2c')).outs).toHaveLength(9);
    expect(drawOuts(parseCards('9c8d'), parseCards('7h6s2c')).outs).toHaveLength(8);
    expect(drawOuts(parseCards('9c8d'), parseCards('Jh7s2c')).outs).toHaveLength(4);
    expect(drawOuts(parseCards('9h8h'), parseCards('7h6h2c')).outs).toHaveLength(15);
  });

  it('compte les outs d’amélioration', () => {
    // Deux overcards : 6 outs
    expect(improvementOuts(parseCards('AcQd'), parseCards('8h5s2c')).outs).toHaveLength(6);
    // Top paire → double paire ou brelan : 5 outs
    expect(improvementOuts(parseCards('KcQd'), parseCards('Kh8s3c')).outs).toHaveLength(5);
    // Paire servie sous le board : seulement le brelan (2 outs)
    expect(improvementOuts(parseCards('7c7d'), parseCards('Kh8s3c')).outs).toHaveLength(2);
  });

  it('calcule cotes et probabilités', () => {
    expect(requiredEquity(50, 100)).toBeCloseTo(1 / 3);
    expect(hitProbability(9, 47, 2)).toBeCloseTo(0.3497, 3);
    expect(hitProbability(9, 46, 1)).toBeCloseTo(0.1957, 3);
  });
});

describe('coach et bots', () => {
  const seats: SeatConfig[] = [
    { id: 'h', name: 'Vous', isHuman: true, profile: null, stack: 1000 },
    { id: 'b1', name: 'Léa', isHuman: false, profile: 'reg', stack: 1000 },
    { id: 'b2', name: 'Marc', isHuman: false, profile: 'lag', stack: 1000 },
  ];

  it('conseille d’ouvrir AA et de coucher 72o', () => {
    let s = createGame(seats);
    s = { ...s, button: 2 };
    s = startHand(s, seededRng(9)); // bouton = vous, premier à parler à trois joueurs
    s.players[0].hole = parseCards('AsAh');
    const advice = getAdvice(s, seededRng(1))!;
    expect(advice.recommendation).toBe('raise');
    expect(gradeDecision(advice, { type: 'raise', amount: 25 }).verdict).toBe('bon');
    s.players[0].hole = parseCards('7d2c');
    const advice2 = getAdvice(s, seededRng(1))!;
    expect(advice2.recommendation).toBe('fold');
    expect(gradeDecision(advice2, { type: 'call' }).verdict).not.toBe('bon');
  });

  it('les bots jouent des parties complètes sans erreur', () => {
    const rng = seededRng(77);
    const botSeats: SeatConfig[] = ['roc', 'reg', 'lag', 'station', 'reg', 'lag'].map((profile, i) => ({
      id: `b${i}`,
      name: `Bot ${i}`,
      isHuman: false,
      profile,
      stack: 1000,
    }));
    let s = createGame(botSeats);
    for (let hand = 0; hand < 120; hand++) {
      if (s.players.filter((p) => p.stack > 0).length < 2) break;
      s = startHand(s, rng);
      let guard = 0;
      while (!s.result) {
        expect(getLegalActions(s)).not.toBeNull();
        s = applyAction(s, decideBot(s, rng));
        if (++guard > 100) throw new Error('bloqué');
      }
    }
    expect(s.players.reduce((a, p) => a + p.stack, 0)).toBe(6000);
  });
});

describe('générateurs d’exercices', () => {
  const rng = seededRng(123);
  it('produisent des questions cohérentes', () => {
    for (let i = 0; i < 40; i++) {
      const pf = generatePreflop(rng);
      expect(['raise', 'fold']).toContain(pf.correct);
      const spot = generateDrawSpot(rng);
      expect(spot.outs.outs.length).toBeGreaterThanOrEqual(4);
      const o = generateOuts(rng);
      expect(o.choices).toContain(o.correct);
      expect(new Set(o.choices).size).toBe(4);
      const po = generatePotOdds(rng);
      expect(Math.abs(po.equity - po.required)).toBeGreaterThanOrEqual(0.025);
      const w = generateWinner(rng);
      expect(w.winners.length).toBeGreaterThan(0);
    }
    for (let i = 0; i < 8; i++) {
      const e = generateEquity(rng);
      expect(e.choices).toHaveLength(4);
      expect(e.correctIndex).toBeGreaterThanOrEqual(0);
    }
  });
});
