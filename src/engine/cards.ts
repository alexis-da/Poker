/**
 * Représentation des cartes : un entier de 0 à 51.
 *   rang  = carte >> 2   (0 = Deux … 12 = As)
 *   couleur = carte & 3  (0 = ♠ pique, 1 = ♥ cœur, 2 = ♦ carreau, 3 = ♣ trèfle)
 * Ce format compact rend l'évaluation et les simulations rapides.
 */
export type Card = number;

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'shdc';
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'] as const;
export const SUIT_NAMES_FR = ['pique', 'cœur', 'carreau', 'trèfle'] as const;

/** Libellé affiché sur la carte (10 plutôt que T). */
export const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A'] as const;

/** Noms français des rangs, au singulier et au pluriel. */
const RANK_NAMES_FR: ReadonlyArray<[string, string]> = [
  ['Deux', 'Deux'],
  ['Trois', 'Trois'],
  ['Quatre', 'Quatre'],
  ['Cinq', 'Cinq'],
  ['Six', 'Six'],
  ['Sept', 'Sept'],
  ['Huit', 'Huit'],
  ['Neuf', 'Neuf'],
  ['Dix', 'Dix'],
  ['Valet', 'Valets'],
  ['Dame', 'Dames'],
  ['Roi', 'Rois'],
  ['As', 'As'],
];

export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;
export const makeCard = (rank: number, suit: number): Card => rank * 4 + suit;

export function rankName(rank: number, plural = false): string {
  return RANK_NAMES_FR[rank][plural ? 1 : 0];
}

/** « de » ou « d' » devant un nom de rang (« Paire d'As », « Paire de Rois »). */
export function deRank(rank: number, plural = true): string {
  const name = rankName(rank, plural);
  return rank === 12 ? `d'${name}` : `de ${name}`;
}

/** « aux » devant un rang au pluriel (« Full aux As »). */
export function auxRank(rank: number): string {
  return `aux ${rankName(rank, true)}`;
}

export function cardToString(c: Card): string {
  return RANK_CHARS[rankOf(c)] + SUIT_CHARS[suitOf(c)];
}

/** Notation lisible avec symbole : « A♠ », « 10♥ ». */
export function cardLabel(c: Card): string {
  return RANK_LABELS[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];
}

export function cardsLabel(cards: readonly Card[]): string {
  return cards.map(cardLabel).join(' ');
}

export function parseCard(s: string): Card {
  const t = s.trim();
  if (t.length !== 2) throw new Error(`Carte invalide : « ${s} »`);
  const r = RANK_CHARS.indexOf(t[0].toUpperCase());
  const su = SUIT_CHARS.indexOf(t[1].toLowerCase());
  if (r < 0 || su < 0) throw new Error(`Carte invalide : « ${s} »`);
  return makeCard(r, su);
}

/** « AsKd », « As Kd » ou « As,Kd » → [cartes]. */
export function parseCards(s: string): Card[] {
  const compact = s.replace(/[\s,]+/g, '');
  if (compact.length % 2 !== 0) throw new Error(`Cartes invalides : « ${s} »`);
  const out: Card[] = [];
  for (let i = 0; i < compact.length; i += 2) out.push(parseCard(compact.slice(i, i + 2)));
  return out;
}

export function fullDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i);
}

export function deckWithout(dead: Iterable<Card>): Card[] {
  const d = new Set(dead);
  return fullDeck().filter((c) => !d.has(c));
}
