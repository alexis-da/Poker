import { describe, expect, it } from 'vitest';
import { parseCards } from '../src/engine/cards';
import { Cat, bestFive, categoryOf, describeScore, evaluate } from '../src/engine/evaluator';

const ev = (s: string) => evaluate(parseCards(s));
const cat = (s: string) => categoryOf(ev(s));

describe('évaluateur', () => {
  it('reconnaît chaque catégorie', () => {
    expect(cat('AsKsQsJsTs2d3c')).toBe(Cat.STRAIGHT_FLUSH);
    expect(cat('As2s3s4s5s9d9c')).toBe(Cat.STRAIGHT_FLUSH);
    expect(cat('9s9h9d9cKs2d3c')).toBe(Cat.QUADS);
    expect(cat('9s9h9dKcKs2d3c')).toBe(Cat.FULL_HOUSE);
    expect(cat('9s9h9dKcKsKd3c')).toBe(Cat.FULL_HOUSE);
    expect(cat('2s7s9sJsKs2d3c')).toBe(Cat.FLUSH);
    expect(cat('5d6c7h8s9dKcKs')).toBe(Cat.STRAIGHT);
    expect(cat('Ad2c3h4s5d9cJs')).toBe(Cat.STRAIGHT);
    expect(cat('7s7h7dKcQs2d3c')).toBe(Cat.TRIPS);
    expect(cat('7s7hKdKcQs2d3c')).toBe(Cat.TWO_PAIR);
    expect(cat('7s7hKdJc9s2d3c')).toBe(Cat.PAIR);
    expect(cat('7s8hKdJc2s4d3c')).toBe(Cat.HIGH_CARD);
  });

  it('ordonne correctement les mains', () => {
    // Quinte blanche < quinte hauteur six
    expect(ev('Ad2c3h4s5d')).toBeLessThan(ev('2c3h4s5d6c'));
    // Couleur > quinte
    expect(ev('2s7s9sJsKs')).toBeGreaterThan(ev('9dTcJhQsKd'));
    // Kicker
    expect(ev('AsAhKd7c2s')).toBeGreaterThan(ev('AdAcQd7c2s'));
    // Double paire : troisième paire ignorée, meilleur kicker retenu
    expect(ev('KsKh9d9c5s5dAc')).toBeGreaterThan(ev('KsKh9d9c5s5dQc'));
    // Full : brelan le plus haut prioritaire
    expect(ev('QsQhQd2c2s')).toBeGreaterThan(ev('JsJhJdAcAs'));
    // Égalité quand le board joue
    expect(ev('2c3dAsKsQsJsTs')).toBe(ev('4c5dAsKsQsJsTs'));
  });

  it('décrit les mains en français', () => {
    expect(describeScore(ev('AsKsQsJsTs'))).toBe('Quinte flush royale');
    expect(describeScore(ev('AsAhAdAcKs'))).toBe("Carré d'As");
    expect(describeScore(ev('KsKhKd7c7s'))).toBe('Full aux Rois par les Sept');
    expect(describeScore(ev('JsJh4d4c2s'))).toBe('Double paire, Valets et Quatre');
    expect(describeScore(ev('QsQh9d4c2s'))).toBe('Paire de Dames');
    expect(describeScore(ev('Ad2c3h4s5d'))).toBe('Quinte hauteur Cinq');
  });

  it('extrait les cinq meilleures cartes', () => {
    const cards = parseCards('AsKs2d3cQsJsTs');
    expect(bestFive(cards).sort()).toEqual(parseCards('AsKsQsJsTs').sort());
  });
});
