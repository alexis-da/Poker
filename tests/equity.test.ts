import { describe, expect, it } from 'vitest';
import { parseCards } from '../src/engine/cards';
import { computeEquity } from '../src/engine/equity';
import { seededRng } from '../src/engine/random';
import { combosOf } from '../src/engine/ranges';

describe('équité', () => {
  it('AA contre KK préflop ≈ 82 %', () => {
    const r = computeEquity([{ cards: parseCards('AsAh') }, { cards: parseCards('KsKh') }], [], {
      iterations: 40000,
      rng: seededRng(1),
    });
    expect(r.equity[0]).toBeGreaterThan(0.8);
    expect(r.equity[0]).toBeLessThan(0.84);
  });

  it('énumération exacte au flop', () => {
    // Tirage couleur + quinte ouverte contre top paire
    const r = computeEquity(
      [{ cards: parseCards('9h8h') }, { cards: parseCards('AsKd') }],
      parseCards('Kh7h6c'),
    );
    expect(r.exact).toBe(true);
    expect(r.samples).toBe(990);
    expect(r.equity[0] + r.equity[1]).toBeCloseTo(1, 6);
    expect(r.equity[0]).toBeGreaterThan(0.5);
  });

  it('gère les mains aléatoires et les ranges', () => {
    const r = computeEquity([{ cards: parseCards('AsAh') }, null, { range: combosOf('KK') }], [], {
      iterations: 5000,
      rng: seededRng(2),
    });
    expect(r.equity.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(r.equity[0]).toBeGreaterThan(0.6);
  });
});
