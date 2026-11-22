import { describe, expect, it } from 'vitest';
import { parseCards } from '../src/engine/cards';
import { ALL_CLASSES, combosOf, gridClass, handClassOf, parseRange, rangeComboCount, rangeToString } from '../src/engine/ranges';

describe('ranges', () => {
  it('compte les combinaisons', () => {
    expect(combosOf('AA')).toHaveLength(6);
    expect(combosOf('AKs')).toHaveLength(4);
    expect(combosOf('AKo')).toHaveLength(12);
    expect(ALL_CLASSES).toHaveLength(169);
    expect(rangeComboCount(new Set(ALL_CLASSES))).toBe(1326);
  });

  it('lit la notation standard', () => {
    expect(parseRange('22+').size).toBe(13);
    expect([...parseRange('KTs+')].sort()).toEqual(['KJs', 'KQs', 'KTs']);
    expect([...parseRange('A5s-A2s')].sort()).toEqual(['A2s', 'A3s', 'A4s', 'A5s']);
    expect([...parseRange('JJ-99')].sort()).toEqual(['99', 'JJ', 'TT']);
    expect([...parseRange('t9')].sort()).toEqual(['T9o', 'T9s']);
    expect(rangeComboCount(parseRange('QQ+, AKs, AKo'))).toBe(34);
  });

  it('réécrit une range de façon compacte', () => {
    const r = parseRange('22+, A2s+, KTs+, AJo+, 76s, A5s-A2s');
    expect(parseRange(rangeToString(r))).toEqual(r);
    expect(rangeToString(parseRange('22+'))).toBe('22+');
    expect(rangeToString(parseRange('AKs'))).toBe('AKs');
  });

  it('classe les mains', () => {
    const [a, b] = parseCards('AhKh');
    expect(handClassOf(a, b)).toBe('AKs');
    expect(handClassOf(...(parseCards('7d7c') as [number, number]))).toBe('77');
    expect(gridClass(0, 1)).toBe('AKs');
    expect(gridClass(1, 0)).toBe('AKo');
  });
});
