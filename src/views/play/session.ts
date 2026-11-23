import { useSyncExternalStore } from 'react';
import { BOT_PROFILES } from '../../engine/bot';
import type { Grade } from '../../engine/coach';
import { applyAction, createGame, startHand, type Action, type GameState, type SeatConfig } from '../../engine/game';
import { pick } from '../../engine/random';
import { recordCoach, recordHand } from '../../store/store';
import { logEvent } from '../../training/db';
import type { TrainingEvent } from '../../training/model';

export const SMALL_BLIND = 5;
export const BIG_BLIND = 10;

const BOT_NAMES = ['Léa', 'Marc', 'Inès', 'Hugo', 'Chloé', 'Samir', 'Jade', 'Théo', 'Nora', 'Paul', 'Zoé', 'Yanis', 'Lina', 'Malik', 'Rose', 'Omar'];

export interface TableConfig {
  opponents: number;
  startingBB: number;
  /** « mix » ou identifiant de profil. */
  profiles: string;
}

export interface FeedbackEntry {
  grade: Grade;
  action: string;
  street: string;
  hand: number;
  /** Événement enregistré pour cette décision (compétence, variante). */
  event: TrainingEvent | null;
}

/** Un joueur éliminé : pas de recave, il quitte la partie avec sa place. */
export interface Elimination {
  name: string;
  isHuman: boolean;
  place: number;
  hand: number;
}

/** Fin de partie : vous êtes éliminé, ou vous avez gagné tous les jetons. */
export interface GameOver {
  won: boolean;
  place: number;
  players: number;
  hands: number;
}

export interface SessionState {
  game: GameState | null;
  config: TableConfig;
  hands: number;
  netBB: number;
  coach: { bon: number; discutable: number; erreur: number };
  feedback: FeedbackEntry | null;
  recordedHand: number;
  notice: string | null;
  eliminations: Elimination[];
  over: GameOver | null;
}

const EMPTY = {
  hands: 0,
  netBB: 0,
  coach: { bon: 0, discutable: 0, erreur: 0 },
  feedback: null,
  recordedHand: 0,
  notice: null,
  eliminations: [],
  over: null,
};

let session: SessionState = {
  game: null,
  config: { opponents: 5, startingBB: 100, profiles: 'mix' },
  ...EMPTY,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<SessionState>) => {
  session = { ...session, ...patch };
  emit();
};

export const getSession = (): SessionState => session;

export function useSession(): SessionState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => session,
    () => session,
  );
}

function makeBot(used: Set<string>, profiles: string, stack: number, index: number): SeatConfig {
  const free = BOT_NAMES.filter((n) => !used.has(n));
  const name = pick(Math.random, free.length ? free : BOT_NAMES);
  used.add(name);
  const profile = profiles === 'mix' ? pick(Math.random, BOT_PROFILES).id : profiles;
  return { id: `bot-${Date.now()}-${index}-${Math.floor(Math.random() * 1e6)}`, name, isHuman: false, profile, stack };
}

export function newTable(config: TableConfig) {
  const stack = config.startingBB * BIG_BLIND;
  const used = new Set<string>();
  const seats: SeatConfig[] = [{ id: 'hero', name: 'Vous', isHuman: true, profile: null, stack }];
  for (let i = 0; i < config.opponents; i++) seats.push(makeBot(used, config.profiles, stack, i));
  const game = startHand(createGame(seats, SMALL_BLIND, BIG_BLIND));
  session = { ...session, ...EMPTY, game, config };
  emit();
}

export function leaveTable() {
  set({ game: null, feedback: null, notice: null, over: null, eliminations: [] });
}

const placeLabel = (n: number) => (n === 1 ? '1er' : `${n}e`);

/**
 * Joueurs éliminés à la fin d'une main : ceux qui avaient des jetons au début de la main et n'en ont plus.
 * À élimination simultanée, le plus gros tapis de départ obtient la meilleure place.
 */
function eliminationsOf(game: GameState): Elimination[] {
  const busted = game.players
    .map((p, i) => ({ p, start: game.startStacks[i] }))
    .filter(({ p, start }) => start > 0 && p.stack <= 0)
    .sort((a, b) => b.start - a.start);
  const alive = game.players.filter((p) => p.stack > 0).length;
  return busted.map(({ p }, k) => ({ name: p.name, isHuman: p.isHuman, place: alive + 1 + k, hand: game.handNumber }));
}

/** Enregistre les statistiques d'une main terminée (une seule fois par main). */
function commit(game: GameState) {
  if (!game.result || session.recordedHand === game.handNumber) {
    set({ game });
    return;
  }
  const hi = game.players.findIndex((p) => p.isHuman);
  const hero = game.players[hi];
  const pre = game.history.filter((h) => h.player === hi && h.street === 'preflop');
  const foldedPre = pre.some((h) => h.type === 'fold');
  const netBB = game.result.net[hi] / game.bigBlind;
  recordHand({
    netBB,
    won: game.result.net[hi] > 0,
    vpip: pre.some((h) => h.type === 'call' || h.type === 'raise'),
    pfr: pre.some((h) => h.type === 'raise'),
    sawFlop: !foldedPre && game.board.length >= 3,
    showdown: game.result.showdown && hero.shown,
    wonShowdown: game.result.showdown && hero.shown && game.result.net[hi] > 0,
    potBB: game.result.pots.reduce((a, p) => a + p.amount, 0) / game.bigBlind,
  });

  const out = eliminationsOf(game);
  const eliminations = [...session.eliminations, ...out];
  const hands = session.hands + 1;
  const players = game.players.length;
  const heroOut = out.find((e) => e.isHuman);
  const alive = game.players.filter((p) => p.stack > 0).length;
  let over: GameOver | null = null;
  if (heroOut) over = { won: false, place: heroOut.place, players, hands };
  else if (alive === 1 && hero.stack > 0) over = { won: true, place: 1, players, hands };

  const botsOut = out.filter((e) => !e.isHuman);
  const notice = botsOut.length
    ? botsOut.map((e) => `${e.name} quitte la table, ${placeLabel(e.place)} place.`).join(' ')
    : null;

  set({
    game,
    recordedHand: game.handNumber,
    hands,
    netBB: Math.round((session.netBB + netBB) * 10) / 10,
    eliminations,
    over,
    notice,
  });
}

export function heroAct(action: Action, grade: Grade | null, label: string, event: TrainingEvent | null = null) {
  const g = session.game;
  if (!g) return;
  const next = applyAction(g, action);
  if (event) logEvent(event);
  if (grade) {
    recordCoach(grade.verdict);
    session = {
      ...session,
      coach: { ...session.coach, [grade.verdict]: session.coach[grade.verdict] + 1 },
      feedback: { grade, action: label, street: g.street, hand: g.handNumber, event },
    };
  }
  commit(next);
}

export function botAct(action: Action) {
  const g = session.game;
  if (!g) return;
  commit(applyAction(g, action));
}

/** Main suivante, avec les seuls joueurs qui ont encore des jetons. */
export function nextHand() {
  const g = session.game;
  if (!g || session.over) return;
  if (g.players.filter((p) => p.stack > 0).length < 2) return;
  set({ game: startHand(g), notice: null });
}

/** Rejoue une partie avec les mêmes réglages. */
export function replay() {
  newTable(session.config);
}

export function clearFeedback() {
  set({ feedback: null });
}

export { placeLabel };
