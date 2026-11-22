import { makeCard, RANK_CHARS, rankOf, suitOf, type Card } from './cards';

/**
 * Classes de mains préflop (169) : « AA », « AKs » (assorties), « AKo » (dépareillées).
 * La grille 13×13 classique : diagonale = paires, au-dessus = assorties, en dessous = dépareillées.
 */
export type HandClass = string;

/** Rangs du plus fort au plus faible, pour l'affichage de la grille. */
export const GRID_RANKS = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export function classFromRanks(hi: number, lo: number, suited: boolean): HandClass {
  if (hi < lo) [hi, lo] = [lo, hi];
  if (hi === lo) return RANK_CHARS[hi] + RANK_CHARS[lo];
  return RANK_CHARS[hi] + RANK_CHARS[lo] + (suited ? 's' : 'o');
}

export function handClassOf(c1: Card, c2: Card): HandClass {
  return classFromRanks(rankOf(c1), rankOf(c2), suitOf(c1) === suitOf(c2));
}

/** Classe de main en (ligne, colonne) de la grille. */
export function gridClass(row: number, col: number): HandClass {
  const r1 = GRID_RANKS[row];
  const r2 = GRID_RANKS[col];
  if (row === col) return classFromRanks(r1, r1, false);
  if (row < col) return classFromRanks(r1, r2, true);
  return classFromRanks(r1, r2, false);
}

export const ALL_CLASSES: HandClass[] = (() => {
  const out: HandClass[] = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out.push(gridClass(r, c));
  return out;
})();

export function parseClass(hc: HandClass): { hi: number; lo: number; kind: 'pair' | 's' | 'o' } {
  const hi = RANK_CHARS.indexOf(hc[0]);
  const lo = RANK_CHARS.indexOf(hc[1]);
  if (hi < 0 || lo < 0) throw new Error(`Main invalide : ${hc}`);
  if (hi === lo) return { hi, lo, kind: 'pair' };
  const k = hc[2];
  if (k !== 's' && k !== 'o') throw new Error(`Main invalide : ${hc}`);
  return hi > lo ? { hi, lo, kind: k } : { hi: lo, lo: hi, kind: k };
}

export function comboCount(hc: HandClass): number {
  const { kind } = parseClass(hc);
  return kind === 'pair' ? 6 : kind === 's' ? 4 : 12;
}

/** Toutes les combinaisons concrètes d'une classe de main. */
export function combosOf(hc: HandClass): [Card, Card][] {
  const { hi, lo, kind } = parseClass(hc);
  const out: [Card, Card][] = [];
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (kind === 'pair') {
        if (s2 > s1) out.push([makeCard(hi, s1), makeCard(lo, s2)]);
      } else if (kind === 's') {
        if (s1 === s2) out.push([makeCard(hi, s1), makeCard(lo, s2)]);
      } else if (s1 !== s2) {
        out.push([makeCard(hi, s1), makeCard(lo, s2)]);
      }
    }
  }
  return out;
}

/**
 * Lecture d'une range en notation standard :
 *   « 22+, A2s+, KTs+, AJo+, KQo, 76s, A5s-A2s, T9 »
 * « T9 » sans suffixe = assorties + dépareillées.
 */
export function parseRange(text: string): Set<HandClass> {
  const out = new Set<HandClass>();
  const tokens = text
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const raw of tokens) {
    const tok = normalize(raw);
    if (tok.includes('-')) {
      const [a, b] = raw.split('-').map(normalize);
      const A = parseClass(a);
      const B = parseClass(b);
      if (A.kind === 'pair' && B.kind === 'pair') {
        const [lo, hi] = [Math.min(A.hi, B.hi), Math.max(A.hi, B.hi)];
        for (let r = lo; r <= hi; r++) out.add(classFromRanks(r, r, false));
      } else if (A.hi === B.hi && A.kind === B.kind) {
        const [lo, hi] = [Math.min(A.lo, B.lo), Math.max(A.lo, B.lo)];
        for (let r = lo; r <= hi; r++) out.add(classFromRanks(A.hi, r, A.kind === 's'));
      } else {
        throw new Error(`Intervalle invalide : ${raw}`);
      }
      continue;
    }
    const plus = tok.endsWith('+');
    const base = plus ? tok.slice(0, -1) : tok;
    if (base.length === 2 && base[0] !== base[1]) {
      // Sans suffixe : les deux variantes.
      for (const k of ['s', 'o']) addToken(out, base + k, plus);
    } else {
      addToken(out, base, plus);
    }
  }
  return out;
}

/** Rangs en majuscules, suffixes (s, o, +) en minuscules : « a5S+ » → « A5s+ ». */
function normalize(t: string): string {
  return t.slice(0, 2).toUpperCase() + t.slice(2).toLowerCase();
}

function addToken(out: Set<HandClass>, hc: HandClass, plus: boolean) {
  const { hi, lo, kind } = parseClass(hc);
  if (!plus) {
    out.add(kind === 'pair' ? classFromRanks(hi, hi, false) : classFromRanks(hi, lo, kind === 's'));
    return;
  }
  if (kind === 'pair') {
    for (let r = hi; r <= 12; r++) out.add(classFromRanks(r, r, false));
  } else {
    for (let r = lo; r < hi; r++) out.add(classFromRanks(hi, r, kind === 's'));
  }
}

/** Écriture compacte d'une range (« 22+, A2s+, KTs+ … »). */
export function rangeToString(range: Set<HandClass>): string {
  const parts: string[] = [];
  // Paires
  const pairs = [];
  for (let r = 12; r >= 0; r--) if (range.has(classFromRanks(r, r, false))) pairs.push(r);
  parts.push(...compressRuns(pairs, 12, (r) => RANK_CHARS[r] + RANK_CHARS[r], true));
  for (const kind of ['s', 'o'] as const) {
    for (let hi = 12; hi >= 1; hi--) {
      const los = [];
      for (let lo = hi - 1; lo >= 0; lo--) if (range.has(classFromRanks(hi, lo, kind === 's'))) los.push(lo);
      parts.push(
        ...compressRuns(los, hi - 1, (lo) => RANK_CHARS[hi] + RANK_CHARS[lo] + kind, false),
      );
    }
  }
  return parts.join(', ');
}

function compressRuns(
  ranksDesc: number[],
  top: number,
  label: (r: number) => string,
  pairs: boolean,
): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < ranksDesc.length) {
    let j = i;
    while (j + 1 < ranksDesc.length && ranksDesc[j + 1] === ranksDesc[j] - 1) j++;
    const start = ranksDesc[i];
    const end = ranksDesc[j];
    if (start === top && j > i) out.push(label(end) + '+');
    else if (start === top && j === i && pairs) out.push(label(end));
    else if (j > i) out.push(`${label(start)}-${label(end)}`);
    else out.push(label(start));
    i = j + 1;
  }
  return out;
}

export function rangeCombos(range: Set<HandClass>, dead: Iterable<Card> = []): [Card, Card][] {
  const d = new Set(dead);
  const out: [Card, Card][] = [];
  for (const hc of range) for (const combo of combosOf(hc)) if (!d.has(combo[0]) && !d.has(combo[1])) out.push(combo);
  return out;
}

export function rangeComboCount(range: Set<HandClass>): number {
  let n = 0;
  for (const hc of range) n += comboCount(hc);
  return n;
}

/** Pourcentage des 1326 combinaisons de départ. */
export function rangePercent(range: Set<HandClass>): number {
  return (rangeComboCount(range) / 1326) * 100;
}
