import { fullDeck, type Card } from './cards';
import { evaluate } from './evaluator';
import { defaultRng, type Rng } from './random';

/**
 * Description d'un joueur pour le calcul d'équité :
 *  - deux cartes connues,
 *  - une range (liste de combinaisons possibles),
 *  - ou null = main totalement aléatoire.
 */
export type EquityPlayer = { cards: Card[] } | { range: [Card, Card][] } | null;

export interface EquityResult {
  /** Part de victoires (hors égalités), 0..1 */
  win: number[];
  /** Part d'égalités, 0..1 */
  tie: number[];
  /** Équité = victoires + part des égalités, 0..1 */
  equity: number[];
  samples: number;
  exact: boolean;
}

export interface EquityOptions {
  iterations?: number;
  rng?: Rng;
  /** Force la simulation même si une énumération exacte est possible. */
  forceMonteCarlo?: boolean;
}

const MAX_EXACT_RUNOUTS = 2000;

function combinations(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

/**
 * Calcule l'équité de chaque joueur. Énumération exacte quand toutes les mains sont
 * connues et qu'il reste peu de cartes à distribuer, Monte Carlo sinon.
 */
export function computeEquity(
  players: EquityPlayer[],
  board: Card[],
  opts: EquityOptions = {},
): EquityResult {
  const n = players.length;
  const rng = opts.rng ?? defaultRng;
  const iterations = opts.iterations ?? 20000;
  const win = new Float64Array(n);
  const tie = new Float64Array(n);
  const eq = new Float64Array(n);

  const used = new Uint8Array(52);
  for (const c of board) used[c] = 1;
  for (const p of players) if (p && 'cards' in p) for (const c of p.cards) used[c] = 1;

  const allKnown = players.every((p) => p && 'cards' in p && p.cards.length === 2);
  const needed = 5 - board.length;
  const avail = fullDeck().filter((c) => !used[c]);

  const hands: Card[][] = players.map(() => new Array<Card>(7));
  const scores = new Int32Array(n);
  const boardBuf = new Array<Card>(5);
  for (let i = 0; i < board.length; i++) boardBuf[i] = board[i];

  const scoreRound = (weight: number) => {
    let best = -1;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const h = hands[i];
      for (let j = 0; j < 5; j++) h[2 + j] = boardBuf[j];
      const s = evaluate(h, 7);
      scores[i] = s;
      if (s > best) {
        best = s;
        count = 1;
      } else if (s === best) count++;
    }
    for (let i = 0; i < n; i++) {
      if (scores[i] === best) {
        if (count === 1) win[i] += weight;
        else tie[i] += weight;
        eq[i] += weight / count;
      }
    }
  };

  if (allKnown && !opts.forceMonteCarlo && combinations(avail.length, needed) <= MAX_EXACT_RUNOUTS) {
    players.forEach((p, i) => {
      const cards = (p as { cards: Card[] }).cards;
      hands[i][0] = cards[0];
      hands[i][1] = cards[1];
    });
    let total = 0;
    const rec = (start: number, depth: number) => {
      if (depth === needed) {
        scoreRound(1);
        total++;
        return;
      }
      for (let i = start; i < avail.length; i++) {
        boardBuf[board.length + depth] = avail[i];
        rec(i + 1, depth + 1);
      }
    };
    rec(0, 0);
    return finalize(win, tie, eq, total, true);
  }

  // Monte Carlo
  let samples = 0;
  const iterUsed = new Uint8Array(52);
  const rangeIdx: number[] = [];
  const randomIdx: number[] = [];
  players.forEach((p, i) => {
    if (p === null) randomIdx.push(i);
    else if ('range' in p) rangeIdx.push(i);
    else {
      hands[i][0] = p.cards[0];
      hands[i][1] = p.cards[1];
    }
  });

  for (let it = 0; it < iterations; it++) {
    iterUsed.set(used);
    let ok = true;
    // Tirage des combinaisons dans les ranges (rejet en cas de conflit).
    for (const i of rangeIdx) {
      const range = (players[i] as { range: [Card, Card][] }).range;
      let found = false;
      for (let tries = 0; tries < 30 && range.length > 0; tries++) {
        const combo = range[Math.floor(rng() * range.length)];
        if (!iterUsed[combo[0]] && !iterUsed[combo[1]]) {
          hands[i][0] = combo[0];
          hands[i][1] = combo[1];
          iterUsed[combo[0]] = 1;
          iterUsed[combo[1]] = 1;
          found = true;
          break;
        }
      }
      if (!found) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    // Fisher-Yates partiel sur les cartes disponibles, en sautant celles déjà prises.
    let k = 0;
    const draw = (): Card => {
      for (;;) {
        const j = k + Math.floor(rng() * (avail.length - k));
        const t = avail[k];
        avail[k] = avail[j];
        avail[j] = t;
        const c = avail[k++];
        if (!iterUsed[c]) {
          iterUsed[c] = 1;
          return c;
        }
      }
    };
    for (const i of randomIdx) {
      hands[i][0] = draw();
      hands[i][1] = draw();
    }
    for (let j = board.length; j < 5; j++) boardBuf[j] = draw();
    scoreRound(1);
    samples++;
  }
  return finalize(win, tie, eq, samples, false);
}

function finalize(
  win: Float64Array,
  tie: Float64Array,
  eq: Float64Array,
  total: number,
  exact: boolean,
): EquityResult {
  const d = total || 1;
  return {
    win: Array.from(win, (x) => x / d),
    tie: Array.from(tie, (x) => x / d),
    equity: Array.from(eq, (x) => x / d),
    samples: total,
    exact,
  };
}

/** Équité d'une main face à `opponents` mains aléatoires. */
export function equityVsRandom(
  hole: Card[],
  board: Card[],
  opponents: number,
  iterations = 3000,
  rng: Rng = defaultRng,
): number {
  const players: EquityPlayer[] = [{ cards: hole }];
  for (let i = 0; i < opponents; i++) players.push(null);
  return computeEquity(players, board, { iterations, rng }).equity[0];
}
