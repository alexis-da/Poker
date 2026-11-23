import type { Card } from '../engine/cards';
import { decideBot } from '../engine/bot';
import { applyAction, createGame, getLegalActions, startHand, type Action, type GameState } from '../engine/game';
import type { Rng } from '../engine/random';

/**
 * Règles d'une table en ligne, sans base de données : elles tournent dans la fonction Supabase
 * (le serveur fait foi) et dans les tests. Le serveur garde l'état complet (paquet, cartes de chacun) ;
 * les joueurs ne reçoivent qu'une vue publique et leurs propres cartes.
 */

export const SMALL_BLIND = 5;
export const BIG_BLIND = 10;
/** Tapis de départ : 100 grosses blinds. */
export const START_STACK = 100 * BIG_BLIND;
/** Délai avant l'action d'un bot (ou d'un joueur absent), pour que la table reste lisible. */
export const BOT_DELAY_MS = 900;
export const AWAY_DELAY_MS = 400;
/** Temps de réflexion d'un joueur avant qu'on se couche (ou checke) à sa place. */
export const TURN_MS = 30_000;
/** Pause entre deux mains, le temps de lire le résultat. */
export const NEXT_HAND_MS = 5_000;
/** Après deux temps écoulés de suite, le joueur est considéré comme absent. */
export const MAX_TIMEOUTS = 2;

/**
 * Montée des blindes, comme en tournoi rapide : un niveau toutes les 6 mains. Avec 100 BB au départ,
 * il ne reste qu'une dizaine de grosses blindes en moyenne vers la 25e main ; une partie à 4-6 joueurs
 * dure ainsi environ 30 à 45 minutes.
 */
export const HANDS_PER_LEVEL = 6;
export const BLIND_LEVELS: readonly (readonly [number, number])[] = [
  [5, 10],
  [10, 20],
  [15, 30],
  [25, 50],
  [50, 100],
  [75, 150],
  [100, 200],
  [150, 300],
  [200, 400],
  [300, 600],
  [500, 1000],
  [750, 1500],
  [1000, 2000],
  [1500, 3000],
  [2500, 5000],
];

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  /** Mains restantes à ce niveau, celle-ci comprise. */
  handsLeft: number;
  /** Dernier niveau atteint : les blindes ne montent plus. */
  last: boolean;
}

export function blindLevel(handNumber: number): BlindLevel {
  const i = Math.min(BLIND_LEVELS.length - 1, Math.floor(Math.max(0, handNumber - 1) / HANDS_PER_LEVEL));
  const [smallBlind, bigBlind] = BLIND_LEVELS[i];
  return {
    level: i + 1,
    smallBlind,
    bigBlind,
    handsLeft: HANDS_PER_LEVEL - (Math.max(0, handNumber - 1) % HANDS_PER_LEVEL),
    last: i === BLIND_LEVELS.length - 1,
  };
}

export const BOT_PROFILES = ['reg', 'lag', 'roc', 'station'] as const;
export const BOT_NAMES = ['Nora', 'Marc', 'Léa', 'Omar', 'Inès'];

export interface Seat {
  /** Identifiant du joueur (compte Supabase) ; null pour un bot. */
  userId: string | null;
  bot: string | null;
  name: string;
  /** Joueur parti ou inactif : on joue à sa place (check ou passe). */
  away: boolean;
}

export interface Placement {
  name: string;
  userId: string | null;
  place: number;
}

/** État complet, connu du seul serveur. */
export interface ServerTable {
  game: GameState;
  seats: Seat[];
  /** Prochaine étape automatique (bot, temps écoulé, main suivante), en ms depuis l'époque. */
  nextAt: number | null;
  /** Fin du temps de réflexion du joueur qui doit parler. */
  deadline: number | null;
  timeouts: Record<string, number>;
  eliminations: Placement[];
  over: boolean;
}

/** Ce que tout le monde voit : sans paquet ni cartes cachées. */
export type PublicTable = Omit<ServerTable, 'timeouts'>;

/** Carte inconnue (dos visible). */
export const HIDDEN: Card = -1;

export class TableError extends Error {}

export function newTable(seats: Seat[], rng: Rng, now: number): ServerTable {
  if (seats.length < 2) throw new TableError('Il faut au moins deux joueurs pour lancer la partie.');
  const game = createGame(
    seats.map((s, i) => ({
      id: s.userId ?? `bot-${i}`,
      name: s.name,
      // Côté serveur personne n'est « vous » : chaque navigateur se reconnaît dans la vue publique.
      isHuman: false,
      profile: s.bot,
      stack: START_STACK,
    })),
    SMALL_BLIND,
    BIG_BLIND,
  );
  const t: ServerTable = { game: startHand(game, rng), seats, nextAt: null, deadline: null, timeouts: {}, eliminations: [], over: false };
  return settle(t, now);
}

/** Calcule la prochaine étape automatique et le temps de réflexion. */
function schedule(t: ServerTable, now: number): ServerTable {
  const g = t.game;
  if (t.over) return { ...t, nextAt: null, deadline: null };
  if (g.result || g.toAct === null) return { ...t, nextAt: now + NEXT_HAND_MS, deadline: null };
  const seat = t.seats[g.toAct];
  if (seat.bot) return { ...t, nextAt: now + BOT_DELAY_MS, deadline: null };
  if (seat.away) return { ...t, nextAt: now + AWAY_DELAY_MS, deadline: null };
  const deadline = now + TURN_MS;
  return { ...t, nextAt: deadline, deadline };
}

function humansInPlay(t: ServerTable, g: GameState): number {
  return t.seats.filter((s, i) => s.userId && !s.away && g.players[i].stack > 0).length;
}

/** Après une action : éliminations, fin de partie, prochaine étape. */
function settle(t: ServerTable, now: number): ServerTable {
  const g = t.game;
  if (!g.result) return schedule(t, now);
  const eliminations = t.eliminations.slice();
  const alive = g.players.filter((p) => p.stack > 0).length;
  // Éliminés pendant cette main (les plus gros tapis de départ finissent devant).
  const busted = g.players
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.stack === 0 && g.startStacks[i] > 0)
    .sort((a, b) => g.startStacks[b.i] - g.startStacks[a.i]);
  let place = alive + busted.length;
  for (const { i } of busted.slice().reverse()) {
    eliminations.push({ name: t.seats[i].name, userId: t.seats[i].userId, place: place-- });
  }
  const next = { ...t, eliminations };
  return alive <= 1 || humansInPlay(next, g) === 0 ? finish(next) : schedule(next, now);
}

/** Fin de partie : classement des joueurs encore en jeu, par tapis. */
function finish(t: ServerTable): ServerTable {
  const left = t.game.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.stack > 0)
    .sort((a, b) => b.p.stack - a.p.stack);
  const eliminations = [
    ...t.eliminations,
    ...left.map(({ i }, k) => ({ name: t.seats[i].name, userId: t.seats[i].userId, place: k + 1 })),
  ];
  return { ...t, eliminations, over: true, nextAt: null, deadline: null };
}

function checkAction(g: GameState, a: Action): Action {
  const legal = getLegalActions(g);
  if (!legal) throw new TableError('Ce n’est pas le moment de jouer.');
  switch (a.type) {
    case 'fold':
      return { type: 'fold' };
    case 'check':
      if (!legal.canCheck) throw new TableError('Impossible de checker : il y a une mise à payer.');
      return { type: 'check' };
    case 'call':
      if (legal.canCheck) return { type: 'check' };
      return { type: 'call' };
    case 'raise': {
      if (!legal.canRaise) throw new TableError('Relance impossible.');
      const amount = Math.round(Number(a.amount));
      if (!Number.isFinite(amount)) throw new TableError('Montant de relance invalide.');
      return { type: 'raise', amount: Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, amount)) };
    }
    default:
      throw new TableError('Action inconnue.');
  }
}

/** Action d'un joueur, refusée si ce n'est pas son tour. */
export function playerAction(t: ServerTable, userId: string, action: Action, now: number): ServerTable {
  const g = t.game;
  if (t.over || g.result || g.toAct === null) throw new TableError('Ce n’est pas le moment de jouer.');
  if (t.seats[g.toAct].userId !== userId) throw new TableError('Ce n’est pas à vous de parler.');
  const seats = t.seats.map((s) => (s.userId === userId ? { ...s, away: false } : s));
  const timeouts = { ...t.timeouts, [userId]: 0 };
  return settle({ ...t, seats, timeouts, game: applyAction(g, checkAction(g, action)) }, now);
}

/** Action automatique, à ne jouer que lorsque l'étape est due. */
function autoAction(g: GameState): Action {
  const legal = getLegalActions(g);
  return legal?.canCheck ? { type: 'check' } : { type: 'fold' };
}

/**
 * Étape automatique due : action d'un bot ou d'un absent, temps écoulé, ou main suivante.
 * Renvoie null si rien n'est encore dû (n'importe quel navigateur peut demander l'étape).
 */
export function step(t: ServerTable, now: number, rng: Rng): ServerTable | null {
  if (t.over || t.nextAt === null || now < t.nextAt) return null;
  const g = t.game;
  if (g.result || g.toAct === null) {
    // Main suivante, aux blindes du niveau en cours. Elle peut se terminer dès la donne
    // (joueurs à tapis sur les blindes) : on fait alors le bilan comme après une action.
    const lvl = blindLevel(g.handNumber + 1);
    return settle({ ...t, game: startHand({ ...g, smallBlind: lvl.smallBlind, bigBlind: lvl.bigBlind }, rng) }, now);
  }
  const seat = t.seats[g.toAct];
  if (seat.bot) return settle({ ...t, game: applyAction(g, decideBot(g, rng)) }, now);
  const timeouts = { ...t.timeouts };
  let seats = t.seats;
  if (!seat.away && seat.userId) {
    timeouts[seat.userId] = (timeouts[seat.userId] ?? 0) + 1;
    if (timeouts[seat.userId] >= MAX_TIMEOUTS) seats = seats.map((s) => (s.userId === seat.userId ? { ...s, away: true } : s));
  }
  return settle({ ...t, seats, timeouts, game: applyAction(g, autoAction(g)) }, now);
}

/** Départ ou retour d'un joueur pendant la partie. */
export function setAway(t: ServerTable, userId: string, away: boolean, now: number): ServerTable {
  if (!t.seats.some((s) => s.userId === userId)) return t;
  const seats = t.seats.map((s) => (s.userId === userId ? { ...s, away } : s));
  const timeouts = { ...t.timeouts, [userId]: 0 };
  const next: ServerTable = { ...t, seats, timeouts };
  if (next.over) return next;
  // Plus aucun joueur réel : la partie s'arrête.
  if (away && humansInPlay(next, next.game) === 0) return finish(next);
  // Si c'était son tour, la prochaine étape est recalculée (jeu automatique ou nouveau délai).
  return next.game.toAct !== null && seats[next.game.toAct].userId === userId ? schedule(next, now) : next;
}

/** Vue publique : sans paquet, cartes des autres cachées tant qu'elles ne sont pas montrées. */
export function publicView(t: ServerTable): PublicTable {
  const g = t.game;
  return {
    game: {
      ...g,
      deck: [],
      players: g.players.map((p) => ({ ...p, hole: p.shown ? p.hole : p.hole.map(() => HIDDEN) })),
    },
    seats: t.seats,
    nextAt: t.nextAt,
    deadline: t.deadline,
    eliminations: t.eliminations,
    over: t.over,
  };
}

/** Cartes privées de chaque joueur réel pour la main en cours. */
export function privateHands(t: ServerTable): { userId: string; hand: number; cards: Card[] }[] {
  return t.seats.flatMap((s, i) =>
    s.userId && t.game.players[i].hole.length ? [{ userId: s.userId, hand: t.game.handNumber, cards: t.game.players[i].hole }] : [],
  );
}

/** Bots pour compléter les places libres (profils variés, noms distincts des joueurs). */
export function botSeats(count: number, taken: string[], rng: Rng): Seat[] {
  const names = BOT_NAMES.filter((n) => !taken.includes(n));
  const out: Seat[] = [];
  for (let i = 0; i < count; i++) {
    const profile = BOT_PROFILES[Math.floor(rng() * BOT_PROFILES.length)];
    out.push({ userId: null, bot: profile, name: names[i] ?? `Bot ${i + 1}`, away: false });
  }
  return out;
}
