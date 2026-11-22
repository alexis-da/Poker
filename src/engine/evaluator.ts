import { auxRank, deRank, rankName, rankOf, suitOf, type Card } from './cards';

/**
 * Évaluateur de mains de 5 à 7 cartes.
 * Renvoie un score entier : plus il est grand, meilleure est la main.
 *   score = catégorie << 20 | k1 << 16 | k2 << 12 | k3 << 8 | k4 << 4 | k5
 * où k1…k5 sont les rangs départageant deux mains de même catégorie.
 */
export const Cat = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;
export type Category = (typeof Cat)[keyof typeof Cat];

export const CATEGORY_NAMES_FR = [
  'Hauteur',
  'Paire',
  'Double paire',
  'Brelan',
  'Quinte',
  'Couleur',
  'Full',
  'Carré',
  'Quinte flush',
] as const;

const rankCounts = new Int8Array(13);
const suitCounts = new Int8Array(4);
const suitMasks = new Int32Array(4);

function enc(cat: number, a = 0, b = 0, c = 0, d = 0, e = 0): number {
  return (cat << 20) | (a << 16) | (b << 12) | (c << 8) | (d << 4) | e;
}

/** Rang de la carte haute de la meilleure quinte présente dans le masque, ou -1. */
function straightHigh(mask: number): number {
  for (let hi = 12; hi >= 4; hi--) {
    const m = 0b11111 << (hi - 4);
    if ((mask & m) === m) return hi;
  }
  // Quinte blanche (roue) : A-2-3-4-5, hauteur Cinq.
  if ((mask & 0b1000000001111) === 0b1000000001111) return 3;
  return -1;
}

/** Les n rangs les plus hauts d'un masque, en excluant éventuellement des rangs. */
function topRanks(mask: number, n: number, out: number[]): void {
  out.length = 0;
  for (let r = 12; r >= 0 && out.length < n; r--) {
    if (mask & (1 << r)) out.push(r);
  }
  while (out.length < n) out.push(0);
}

const kick: number[] = [];

export function evaluate(cards: ArrayLike<Card>, n: number = cards.length): number {
  rankCounts.fill(0);
  suitCounts.fill(0);
  suitMasks.fill(0);
  let mask = 0;
  for (let i = 0; i < n; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    rankCounts[r]++;
    suitCounts[s]++;
    suitMasks[s] |= 1 << r;
    mask |= 1 << r;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCounts[s] >= 5) flushSuit = s;

  if (flushSuit >= 0) {
    const sh = straightHigh(suitMasks[flushSuit]);
    if (sh >= 0) return enc(Cat.STRAIGHT_FLUSH, sh);
  }

  let quad = -1;
  let trips1 = -1;
  let trips2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const cnt = rankCounts[r];
    if (cnt === 4) quad = r;
    else if (cnt === 3) {
      if (trips1 < 0) trips1 = r;
      else if (trips2 < 0) trips2 = r;
    } else if (cnt === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  if (quad >= 0) {
    topRanks(mask & ~(1 << quad), 1, kick);
    return enc(Cat.QUADS, quad, kick[0]);
  }
  if (trips1 >= 0 && (trips2 >= 0 || pair1 >= 0)) {
    return enc(Cat.FULL_HOUSE, trips1, Math.max(trips2, pair1));
  }
  if (flushSuit >= 0) {
    topRanks(suitMasks[flushSuit], 5, kick);
    return enc(Cat.FLUSH, kick[0], kick[1], kick[2], kick[3], kick[4]);
  }
  const sh = straightHigh(mask);
  if (sh >= 0) return enc(Cat.STRAIGHT, sh);
  if (trips1 >= 0) {
    topRanks(mask & ~(1 << trips1), 2, kick);
    return enc(Cat.TRIPS, trips1, kick[0], kick[1]);
  }
  if (pair1 >= 0 && pair2 >= 0) {
    topRanks(mask & ~(1 << pair1) & ~(1 << pair2), 1, kick);
    return enc(Cat.TWO_PAIR, pair1, pair2, kick[0]);
  }
  if (pair1 >= 0) {
    topRanks(mask & ~(1 << pair1), 3, kick);
    return enc(Cat.PAIR, pair1, kick[0], kick[1], kick[2]);
  }
  topRanks(mask, 5, kick);
  return enc(Cat.HIGH_CARD, kick[0], kick[1], kick[2], kick[3], kick[4]);
}

export const categoryOf = (score: number): Category => (score >> 20) as Category;

function nib(score: number, i: number): number {
  return (score >> (16 - 4 * i)) & 0xf;
}

/** Description française d'une main à partir de son score. */
export function describeScore(score: number): string {
  const cat = categoryOf(score);
  const a = nib(score, 0);
  const b = nib(score, 1);
  switch (cat) {
    case Cat.STRAIGHT_FLUSH:
      return a === 12 ? 'Quinte flush royale' : `Quinte flush hauteur ${rankName(a)}`;
    case Cat.QUADS:
      return `Carré ${deRank(a)}`;
    case Cat.FULL_HOUSE:
      return `Full ${auxRank(a)} par les ${rankName(b, true)}`;
    case Cat.FLUSH:
      return `Couleur hauteur ${rankName(a)}`;
    case Cat.STRAIGHT:
      return `Quinte hauteur ${rankName(a)}`;
    case Cat.TRIPS:
      return `Brelan ${deRank(a)}`;
    case Cat.TWO_PAIR:
      return `Double paire, ${rankName(a, true)} et ${rankName(b, true)}`;
    case Cat.PAIR:
      return `Paire ${deRank(a)}`;
    default:
      return `Hauteur ${rankName(a)}`;
  }
}

/** Description avec kicker quand il départage souvent (paire, hauteur). */
export function describeScoreLong(score: number): string {
  const cat = categoryOf(score);
  const base = describeScore(score);
  if (cat === Cat.PAIR) return `${base}, kicker ${rankName(nib(score, 1))}`;
  if (cat === Cat.TWO_PAIR) return `${base}, kicker ${rankName(nib(score, 2))}`;
  if (cat === Cat.TRIPS) return `${base}, kicker ${rankName(nib(score, 1))}`;
  if (cat === Cat.HIGH_CARD) return `${base}, puis ${rankName(nib(score, 1))}`;
  return base;
}

export function describeHand(cards: readonly Card[]): string {
  return describeScore(evaluate(cards));
}

/** Les cinq cartes qui forment la meilleure main (pour la mise en évidence à l'écran). */
export function bestFive(cards: readonly Card[]): Card[] {
  if (cards.length <= 5) return cards.slice();
  let best = -1;
  let bestCombo: Card[] = [];
  const n = cards.length;
  const combo = new Array<Card>(5);
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            combo[0] = cards[a];
            combo[1] = cards[b];
            combo[2] = cards[c];
            combo[3] = cards[d];
            combo[4] = cards[e];
            const s = evaluate(combo, 5);
            if (s > best) {
              best = s;
              bestCombo = combo.slice();
            }
          }
  return bestCombo;
}

/** Trie des cartes du plus haut rang au plus bas (puis par couleur). */
export function sortCards(cards: readonly Card[]): Card[] {
  return cards.slice().sort((x, y) => rankOf(y) - rankOf(x) || suitOf(x) - suitOf(y));
}
