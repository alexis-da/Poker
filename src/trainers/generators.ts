import { HAND_TOP_PERCENT, RFI_SETS, type Position } from '../data/charts';
import { OPEN_PERCENT } from '../engine/bot';
import { makeCard, rankOf, type Card } from '../engine/cards';
import { computeEquity } from '../engine/equity';
import { bestFive, Cat, categoryOf, describeScore, evaluate } from '../engine/evaluator';
import { drawOuts, hitProbability, requiredEquity, type OutsResult } from '../engine/outs';
import { defaultRng, pick, randInt, shuffle, type Rng } from '../engine/random';
import { ALL_CLASSES, combosOf, handClassOf } from '../engine/ranges';

export type RfiPosition = Exclude<Position, 'BB'>;
export const RFI_POSITIONS: RfiPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

// ——— 1. Ranges d'ouverture ———

export interface PreflopQuestion {
  position: RfiPosition;
  hand: [Card, Card];
  handClass: string;
  correct: 'raise' | 'fold';
}

export function generatePreflop(rng: Rng = defaultRng, position?: RfiPosition): PreflopQuestion {
  const pos = position ?? pick(rng, RFI_POSITIONS);
  const threshold = OPEN_PERCENT[pos];
  let hc: string;
  if (rng() < 0.6) {
    // Mains proches de la limite : les plus instructives.
    const near = ALL_CLASSES.filter((h) => Math.abs(HAND_TOP_PERCENT[h] - threshold) < 14);
    hc = pick(rng, near);
  } else {
    const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), rng);
    hc = handClassOf(deck[0], deck[1]);
  }
  const combo = pick(rng, combosOf(hc));
  const hand: [Card, Card] = rng() < 0.5 ? [combo[0], combo[1]] : [combo[1], combo[0]];
  return { position: pos, hand, handClass: hc, correct: RFI_SETS[pos].has(hc) ? 'raise' : 'fold' };
}

// ——— Tirages (outs et cotes) ———

export interface DrawSpot {
  hole: Card[];
  board: Card[];
  outs: OutsResult;
  drawName: string;
}

export function drawName(outs: OutsResult): string {
  const flush = outs.groups.find((g) => g.category === Cat.FLUSH)?.cards.length ?? 0;
  const straight = outs.groups.find((g) => g.category === Cat.STRAIGHT)?.cards.length ?? 0;
  if (flush > 0 && straight > 0) return 'Tirage couleur + tirage quinte';
  if (flush > 0) return 'Tirage couleur';
  const straightRanks = new Set(outs.outs.map(rankOf)).size;
  if (straightRanks >= 2) return straight >= 8 ? 'Tirage quinte par les deux bouts' : 'Double tirage quinte';
  return 'Tirage quinte ventrale';
}

export type DrawKind = 'couleur' | 'quinte-ouverte' | 'ventrale' | 'combo';

/** Famille du tirage, pour cibler les exercices. */
export function drawKind(outs: OutsResult): DrawKind {
  const flush = outs.groups.find((g) => g.category === Cat.FLUSH)?.cards.length ?? 0;
  const straight = outs.groups.find((g) => g.category === Cat.STRAIGHT)?.cards.length ?? 0;
  if (flush > 0 && straight > 0) return 'combo';
  if (flush > 0) return 'couleur';
  return outs.outs.length >= 8 ? 'quinte-ouverte' : 'ventrale';
}

/** Génère une main avec un tirage quinte ou couleur (4 à 15 outs) et sans main faite au-delà d'un brelan. */
export function generateDrawSpot(rng: Rng = defaultRng, street?: 'flop' | 'turn', kind?: DrawKind): DrawSpot {
  for (let tries = 0; tries < 40000; tries++) {
    const st = street ?? (rng() < 0.6 ? 'flop' : 'turn');
    const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), rng);
    let hole: Card[];
    // Mains connectées ou assorties plus souvent : plus de tirages.
    if (rng() < 0.7) {
      const r1 = 4 + randInt(rng, 9);
      const r2 = Math.max(0, r1 - 1 - randInt(rng, 3));
      const s1 = randInt(rng, 4);
      const s2 = rng() < 0.55 ? s1 : (s1 + 1 + randInt(rng, 3)) % 4;
      hole = [makeCard(r1, s1), makeCard(r2, s2)];
    } else hole = [deck[0], deck[1]];
    const rest = deck.filter((c) => !hole.includes(c));
    const board = rest.slice(0, st === 'flop' ? 3 : 4);
    const current = categoryOf(evaluate([...hole, ...board]));
    if (current >= Cat.TWO_PAIR) continue;
    const outs = drawOuts(hole, board);
    const n = outs.outs.length;
    if (n < 4 || n > 15) continue;
    if (kind && drawKind(outs) !== kind) continue;
    return { hole, board, outs, drawName: drawName(outs) };
  }
  throw new Error('Impossible de générer un tirage');
}

// ——— 2. Outs ———

export interface OutsQuestion extends DrawSpot {
  choices: number[];
  correct: number;
}

export function generateOuts(rng: Rng = defaultRng, kind?: DrawKind): OutsQuestion {
  const spot = generateDrawSpot(rng, undefined, kind);
  const correct = spot.outs.outs.length;
  const pool = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].filter((x) => x !== correct);
  const near = shuffle(pool.filter((x) => Math.abs(x - correct) <= 5), rng).slice(0, 3);
  const choices = [...near, correct].sort((a, b) => a - b);
  return { ...spot, choices, correct };
}

// ——— 3. Cotes du pot ———

export interface PotOddsQuestion extends DrawSpot {
  /** Pot avant la mise adverse, en BB. */
  pot: number;
  /** Mise adverse à payer, en BB. */
  bet: number;
  allIn: boolean;
  cardsToCome: 1 | 2;
  /** Probabilité exacte de toucher. */
  equity: number;
  required: number;
  correct: 'call' | 'fold';
}

const BET_FRACTIONS = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5];

export function generatePotOdds(rng: Rng = defaultRng, mode?: 'tapis' | 'une-carte'): PotOddsQuestion {
  for (let tries = 0; tries < 200; tries++) {
    const spot = generateDrawSpot(rng, mode === 'tapis' ? 'flop' : undefined);
    const onFlop = spot.board.length === 3;
    const allIn = mode === 'tapis' ? true : mode === 'une-carte' ? false : onFlop && rng() < 0.45;
    const cardsToCome: 1 | 2 = allIn ? 2 : 1;
    const unseen = 52 - 2 - spot.board.length;
    const equity = hitProbability(spot.outs.outs.length, unseen, cardsToCome);
    const pot = Math.round((4 + rng() * 26) * 2) / 2;
    const bet = Math.max(1, Math.round(pot * pick(rng, BET_FRACTIONS) * 2) / 2);
    const required = requiredEquity(bet, pot + bet);
    if (Math.abs(equity - required) < 0.025) continue;
    return { ...spot, pot, bet, allIn, cardsToCome, equity, required, correct: equity >= required ? 'call' : 'fold' };
  }
  throw new Error('Impossible de générer une situation de cotes');
}

// ——— 4. Quelle main gagne ? ———

export interface WinnerPlayer {
  name: string;
  hole: Card[];
  score: number;
  handName: string;
  best: Card[];
}

export interface WinnerQuestion {
  board: Card[];
  players: WinnerPlayer[];
  /** Indices des gagnants (plusieurs = partage). */
  winners: number[];
}

const QUIZ_NAMES = ['Joueur A', 'Joueur B', 'Joueur C'];

export type WinnerMode = 'kicker' | 'partage' | 'categorie';

export function generateWinner(rng: Rng = defaultRng, mode?: WinnerMode): WinnerQuestion {
  for (let tries = 0; tries < 20000; tries++) {
    const n = rng() < 0.6 ? 2 : 3;
    const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), rng);
    const board = deck.slice(0, 5);
    const players: WinnerPlayer[] = [];
    for (let i = 0; i < n; i++) {
      const hole = deck.slice(5 + 2 * i, 7 + 2 * i);
      const score = evaluate([...hole, ...board]);
      players.push({ name: QUIZ_NAMES[i], hole, score, handName: describeScore(score), best: bestFive([...hole, ...board]) });
    }
    const sorted = players.map((p) => p.score).sort((a, b) => b - a);
    const sameCategory = categoryOf(sorted[0]) === categoryOf(sorted[1]);
    const split = sorted[0] === sorted[1];
    if (mode === 'partage' && !split) continue;
    if (mode === 'kicker' && (!sameCategory || split)) continue;
    if (mode === 'categorie' && sameCategory) continue;
    if (!mode) {
      // Deux fois sur trois, on garde une situation serrée (même catégorie de main).
      if (!sameCategory && rng() < 0.65) continue;
      if (categoryOf(sorted[0]) === Cat.HIGH_CARD && rng() < 0.7) continue;
    }
    const winners = players.map((p, i) => (p.score === sorted[0] ? i : -1)).filter((i) => i >= 0);
    return { board, players, winners };
  }
  throw new Error('Impossible de générer une donne');
}

// ——— 5. Estimer l'équité ———

export interface EquityQuestion {
  hands: [Card[], Card[]];
  board: Card[];
  /** Équité exacte ou estimée de la main A (0..1). */
  equity: number;
  /** Propositions en %, dont `correctIndex` est la plus proche. */
  choices: number[];
  correctIndex: number;
  matchup: string | null;
}

/** Nom du duel préflop classique et sa répartition typique. */
export function classifyMatchup(a: Card[], b: Card[]): string | null {
  const ra = a.map(rankOf).sort((x, y) => y - x);
  const rb = b.map(rankOf).sort((x, y) => y - x);
  const pairA = ra[0] === ra[1];
  const pairB = rb[0] === rb[1];
  if (pairA && pairB) return 'Paire contre paire inférieure : environ 80 / 20.';
  const describePairVs = (p: number[], o: number[]): string => {
    const overs = o.filter((r) => r > p[0]).length;
    if (overs === 2) return 'Paire contre deux cartes supérieures : environ 55 / 45, la fameuse « bataille de pièces ».';
    if (overs === 1) return 'Paire contre une carte supérieure et une inférieure : environ 70 / 30.';
    if (o.includes(p[0])) return 'Paire contre une main qui contient une carte de même rang : la paire est très favorite (≈ 85 / 15 à 90 / 10).';
    return 'Paire contre deux cartes inférieures : environ 80 / 20 à 85 / 15.';
  };
  if (pairA) return describePairVs(ra, rb);
  if (pairB) return describePairVs(rb, ra);
  const shared = ra.filter((r) => rb.includes(r));
  if (shared.length === 1) return 'Main dominée (une carte en commun, kicker inférieur) : environ 70 / 30 pour la meilleure.';
  if (ra[1] > rb[0] || rb[1] > ra[0]) return 'Deux cartes supérieures contre deux inférieures : environ 63 / 37.';
  if ((ra[0] > rb[0] && ra[1] < rb[1]) || (rb[0] > ra[0] && rb[1] < ra[1]))
    return 'Cartes « intercalées » (haute + basse contre deux moyennes) : environ 55 / 45 pour la plus haute carte.';
  return null;
}

export function generateEquity(rng: Rng = defaultRng, street?: 'preflop' | 'flop'): EquityQuestion {
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), rng);
  const flop = street ? street === 'flop' : rng() < 0.45;
  let a = deck.slice(0, 2);
  let b = deck.slice(2, 4);
  if (!flop && rng() < 0.5) {
    // Duel « classique » : une paire contre deux cartes différentes.
    const pr = randInt(rng, 13);
    const s = shuffle([0, 1, 2, 3], rng);
    a = [makeCard(pr, s[0]), makeCard(pr, s[1])];
    b = deck.filter((c) => !a.includes(c)).slice(0, 2);
    if (rng() < 0.5) [a, b] = [b, a];
  }
  const used = new Set([...a, ...b]);
  const board = flop ? deck.filter((c) => !used.has(c)).slice(0, 3) : [];
  const res = computeEquity([{ cards: a }, { cards: b }], board, { iterations: 12000, rng });
  const equity = res.equity[0];
  const correctPct = Math.min(95, Math.max(5, Math.round((equity * 100) / 5) * 5));
  const offsets = shuffle([-30, -20, -15, 15, 20, 30], rng);
  const choices = [correctPct];
  for (const o of offsets) {
    const v = correctPct + o;
    if (v < 3 || v > 97) continue;
    if (choices.every((c) => Math.abs(c - v) >= 10)) choices.push(v);
    if (choices.length === 4) break;
  }
  for (let v = 5; choices.length < 4 && v <= 95; v += 10) if (choices.every((c) => Math.abs(c - v) >= 10)) choices.push(v);
  choices.sort((x, y) => x - y);
  return {
    hands: [a, b],
    board,
    equity,
    choices,
    correctIndex: choices.indexOf(correctPct),
    matchup: flop ? null : classifyMatchup(a, b),
  };
}
