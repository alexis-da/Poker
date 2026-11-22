import { rankOf, type Card } from './cards';
import { Cat, CATEGORY_NAMES_FR, categoryOf, evaluate } from './evaluator';

export interface OutsGroup {
  category: number;
  label: string;
  cards: Card[];
}

export interface OutsResult {
  outs: Card[];
  groups: OutsGroup[];
  /** Cartes restantes dans le paquet (inconnues). */
  unseen: number;
}

/**
 * Outs « qui améliorent la main » : cartes qui font passer la main à une catégorie
 * supérieure, à condition que l'amélioration vienne de nos cartes privatives
 * (une carte qui double le board et améliore tout le monde ne compte pas).
 *
 * Exemples : tirage couleur = 9 outs, quinte ouverte = 8, ventrale = 4,
 * deux overcards = 6, paire → double paire ou brelan = 5.
 */
export function improvementOuts(hole: Card[], board: Card[]): OutsResult {
  const known = new Set([...hole, ...board]);
  const current = categoryOf(evaluate([...hole, ...board]));
  const holeRanks = new Set(hole.map(rankOf));
  const outs: Card[] = [];
  const byCat = new Map<number, Card[]>();
  for (let c = 0; c < 52; c++) {
    if (known.has(c)) continue;
    const cat = categoryOf(evaluate([...hole, ...board, c]));
    if (cat <= current) continue;
    const boardCat = categoryOf(evaluate([...board, c]));
    if (cat <= boardCat) continue;
    const drawLike = cat === Cat.STRAIGHT || cat === Cat.FLUSH || cat === Cat.STRAIGHT_FLUSH;
    const fromSet = cat >= Cat.FULL_HOUSE && current >= Cat.TRIPS;
    if (!drawLike && !fromSet && !holeRanks.has(rankOf(c))) continue;
    outs.push(c);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(c);
  }
  const groups = [...byCat.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([category, cards]) => ({ category, label: CATEGORY_NAMES_FR[category], cards }));
  return { outs, groups, unseen: 52 - known.size };
}

/**
 * Outs pour toucher un tirage : cartes qui donnent au moins une quinte ou une couleur
 * (en utilisant nos cartes : le board seul ne doit pas la former).
 */
export function drawOuts(hole: Card[], board: Card[]): OutsResult {
  const known = new Set([...hole, ...board]);
  const outs: Card[] = [];
  const byCat = new Map<number, Card[]>();
  for (let c = 0; c < 52; c++) {
    if (known.has(c)) continue;
    const score = evaluate([...hole, ...board, c]);
    const cat = categoryOf(score);
    if (cat !== Cat.STRAIGHT && cat !== Cat.FLUSH && cat !== Cat.STRAIGHT_FLUSH) continue;
    if (evaluate([...board, c]) >= score) continue;
    outs.push(c);
    const key = cat === Cat.STRAIGHT_FLUSH ? Cat.FLUSH : cat;
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(c);
  }
  const groups = [...byCat.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([category, cards]) => ({ category, label: CATEGORY_NAMES_FR[category], cards }));
  return { outs, groups, unseen: 52 - known.size };
}

/** Probabilité exacte de toucher au moins un out avec 1 ou 2 cartes à venir. */
export function hitProbability(outs: number, unseen: number, cardsToCome: 1 | 2): number {
  if (cardsToCome === 1) return outs / unseen;
  return 1 - ((unseen - outs) / unseen) * ((unseen - 1 - outs) / (unseen - 1));
}

/** Règle du 2 et du 4 : outs × 2 (une carte) ou × 4 (deux cartes), en %. */
export function ruleOf2And4(outs: number, cardsToCome: 1 | 2): number {
  return Math.min(100, outs * (cardsToCome === 1 ? 2 : 4));
}

/** Équité nécessaire pour suivre : mise à payer / (pot après avoir suivi). */
export function requiredEquity(toCall: number, potBeforeCall: number): number {
  if (toCall <= 0) return 0;
  return toCall / (potBeforeCall + toCall);
}
