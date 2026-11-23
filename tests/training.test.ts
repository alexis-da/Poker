import { describe, expect, it } from 'vitest';
import { parseCards } from '../src/engine/cards';
import { getAdvice, gradeDecision } from '../src/engine/coach';
import { createGame, startHand, type SeatConfig } from '../src/engine/game';
import { seededRng } from '../src/engine/random';
import { classifyDecision } from '../src/training/classify';
import type { TrainingEvent } from '../src/training/model';
import { recentMistakes, recommend, skillStats } from '../src/training/recommend';
import { drawKind, generateEquity, generateOuts, generatePotOdds, generateWinner } from '../src/trainers/generators';

const NOW = Date.UTC(2026, 10, 23, 12);
const DAY = 86_400_000;
const ev = (p: Partial<TrainingEvent>): TrainingEvent => ({ t: NOW - DAY, src: 'quiz', skill: 'outs', ok: 1, ...p });

describe('recommandations', () => {
  it('propose des exercices à découvrir sans historique', () => {
    const recs = recommend([], NOW);
    expect(recs).toHaveLength(3);
    expect(recs.every((r) => r.kind === 'decouverte')).toBe(true);
  });

  it('met en tête la compétence la plus ratée, avec la variante à cibler', () => {
    const events: TrainingEvent[] = [
      ...Array.from({ length: 6 }, (_, i) => ev({ skill: 'pot-odds', ok: 0, tag: 'tapis', t: NOW - i * 3600_000 })),
      ...Array.from({ length: 4 }, () => ev({ skill: 'pot-odds', ok: 1, tag: 'une-carte' })),
      ...Array.from({ length: 10 }, () => ev({ skill: 'outs', ok: 1 })),
      ev({ skill: 'outs', ok: 0, tag: 'ventrale' }),
    ];
    const recs = recommend(events, NOW);
    expect(recs[0].skill).toBe('pot-odds');
    expect(recs[0].kind).toBe('faiblesse');
    expect(recs[0].focus).toEqual({ quiz: 'potodds', value: 'tapis' });
    expect(recs[0].reason).toContain('6 erreurs sur 10');
  });

  it('oublie les erreurs anciennes et compte les décisions discutables pour moitié', () => {
    const old = Array.from({ length: 8 }, () => ev({ skill: 'showdown', ok: 0, t: NOW - 45 * DAY }));
    expect(recommend(old, NOW).every((r) => r.kind === 'decouverte' || r.skill !== 'showdown')).toBe(true);
    const stats = skillStats([ev({ skill: 'value', src: 'jeu', ok: 0.5 }), ev({ skill: 'value', src: 'jeu', ok: 0 })], NOW);
    expect(stats.value.errors).toBe(1.5);
    expect(stats.value.playCount).toBe(2);
  });

  it('liste les erreurs récentes, la plus récente en premier', () => {
    const list = recentMistakes([ev({ ok: 0, t: NOW - 3 * DAY }), ev({ ok: 1 }), ev({ ok: 0, t: NOW - DAY })]);
    expect(list.map((e) => e.t)).toEqual([NOW - DAY, NOW - 3 * DAY]);
  });
});

describe('classement des décisions de jeu', () => {
  it('range une ouverture préflop ratée dans « Ouvertures préflop » avec la position', () => {
    const seats: SeatConfig[] = [
      { id: 'h', name: 'Vous', isHuman: true, profile: null, stack: 1000 },
      { id: 'b1', name: 'Léa', isHuman: false, profile: 'reg', stack: 1000 },
      { id: 'b2', name: 'Marc', isHuman: false, profile: 'reg', stack: 1000 },
    ];
    let s = createGame(seats);
    s = { ...s, button: 2 };
    s = startHand(s, seededRng(9));
    s.players[0].hole = parseCards('7d2c');
    const advice = getAdvice(s, seededRng(1))!;
    const action = { type: 'call' as const };
    const e = classifyDecision(advice, action, gradeDecision(advice, action), NOW);
    expect(e.skill).toBe('preflop-open');
    expect(e.tag).toBe(advice.position);
    expect(e.ok).toBeLessThan(1);
    expect(e.note).toBeTruthy();
  });
});

describe('exercices ciblés', () => {
  const rng = seededRng(5);
  it('respectent la variante demandée', () => {
    for (const kind of ['couleur', 'quinte-ouverte', 'ventrale', 'combo'] as const) {
      expect(drawKind(generateOuts(rng, kind).outs)).toBe(kind);
    }
    expect(generatePotOdds(rng, 'tapis').allIn).toBe(true);
    expect(generatePotOdds(rng, 'une-carte').allIn).toBe(false);
    expect(generateWinner(rng, 'partage').winners.length).toBeGreaterThan(1);
    expect(generateWinner(rng, 'kicker').winners).toHaveLength(1);
    expect(generateEquity(rng, 'flop').board).toHaveLength(3);
    expect(generateEquity(rng, 'preflop').board).toHaveLength(0);
  });
});
