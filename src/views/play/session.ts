import { useSyncExternalStore } from 'react';
import { BOT_PROFILES } from '../../engine/bot';
import type { Grade } from '../../engine/coach';
import {
  applyAction,
  createGame,
  potTotal,
  setPlayer,
  startHand,
  type Action,
  type GameState,
  type SeatConfig,
} from '../../engine/game';
import { pick } from '../../engine/random';
import { recordCoach, recordHand } from '../../store/store';

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
}

let session: SessionState = {
  game: null,
  config: { opponents: 5, startingBB: 100, profiles: 'mix' },
  hands: 0,
  netBB: 0,
  coach: { bon: 0, discutable: 0, erreur: 0 },
  feedback: null,
  recordedHand: 0,
  notice: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<SessionState>) => {
  session = { ...session, ...patch };
  emit();
};

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
  session = {
    ...session,
    game,
    config,
    hands: 0,
    netBB: 0,
    coach: { bon: 0, discutable: 0, erreur: 0 },
    feedback: null,
    recordedHand: 0,
    notice: null,
  };
  emit();
}

export function leaveTable() {
  set({ game: null, feedback: null, notice: null });
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
  const wasDealt = !hero.sittingOut;
  if (wasDealt) {
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
  }
  set({
    game,
    recordedHand: game.handNumber,
    hands: session.hands + (wasDealt ? 1 : 0),
    netBB: Math.round((session.netBB + netBB) * 10) / 10,
  });
}

export function heroAct(action: Action, grade: Grade | null, label: string) {
  const g = session.game;
  if (!g) return;
  const next = applyAction(g, action);
  if (grade) {
    recordCoach(grade.verdict);
    session = {
      ...session,
      coach: { ...session.coach, [grade.verdict]: session.coach[grade.verdict] + 1 },
      feedback: { grade, action: label, street: g.street, hand: g.handNumber },
    };
  }
  commit(next);
}

export function botAct(action: Action) {
  const g = session.game;
  if (!g) return;
  commit(applyAction(g, action));
}

export function nextHand() {
  let g = session.game;
  if (!g) return;
  const notices: string[] = [];
  const used = new Set(g.players.map((p) => p.name));
  g.players.forEach((p, i) => {
    if (!p.isHuman && p.stack <= 0) {
      const bot = makeBot(used, session.config.profiles, session.config.startingBB * BIG_BLIND, i);
      notices.push(`${p.name} n’a plus de jetons : ${bot.name} prend sa place.`);
      g = setPlayer(g!, i, bot);
    }
  });
  const hero = g.players.find((p) => p.isHuman)!;
  if (hero.stack <= 0) {
    set({ game: g, notice: 'Vous n’avez plus de jetons.' });
    return;
  }
  set({ game: startHand(g), notice: notices.length ? notices.join(' ') : null });
}

export function rebuy() {
  const g = session.game;
  if (!g) return;
  const i = g.players.findIndex((p) => p.isHuman);
  const game = setPlayer(g, i, { stack: session.config.startingBB * BIG_BLIND });
  set({ game: startHand(game), notice: `Recave de ${session.config.startingBB} BB.` });
}

export function clearFeedback() {
  set({ feedback: null });
}

export { potTotal };
