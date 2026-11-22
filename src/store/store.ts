import { useSyncExternalStore } from 'react';

/**
 * Petit magasin persistant (localStorage) pour les statistiques et les réglages.
 * Si le stockage est indisponible (navigation privée…), tout fonctionne en mémoire.
 */
export type QuizId = 'preflop' | 'outs' | 'potodds' | 'winner' | 'equity';

export interface QuizStats {
  attempts: number;
  correct: number;
  streak: number;
  bestStreak: number;
  /** Derniers résultats (true = bonne réponse), 50 au plus. */
  recent: boolean[];
}

export interface PlayStats {
  hands: number;
  handsWon: number;
  /** Gain net cumulé en BB. */
  netBB: number;
  vpip: number;
  pfr: number;
  sawFlop: number;
  showdowns: number;
  showdownsWon: number;
  /** Gain cumulé en BB après chaque main (300 dernières). */
  curve: number[];
  coach: { bon: number; discutable: number; erreur: number };
  biggestPotBB: number;
}

export interface Settings {
  fourColor: boolean;
  botSpeed: 'lent' | 'normal' | 'rapide';
  coachMode: 'visible' | 'apres' | 'off';
  opponents: number;
  startingBB: number;
  autoNext: boolean;
}

export interface AppData {
  version: 1;
  play: PlayStats;
  quizzes: Record<QuizId, QuizStats>;
  settings: Settings;
}

const KEY = 'poker-coach:v1';

const emptyQuiz = (): QuizStats => ({ attempts: 0, correct: 0, streak: 0, bestStreak: 0, recent: [] });

export const emptyPlay = (): PlayStats => ({
  hands: 0,
  handsWon: 0,
  netBB: 0,
  vpip: 0,
  pfr: 0,
  sawFlop: 0,
  showdowns: 0,
  showdownsWon: 0,
  curve: [],
  coach: { bon: 0, discutable: 0, erreur: 0 },
  biggestPotBB: 0,
});

export const defaultSettings = (): Settings => ({
  fourColor: true,
  botSpeed: 'normal',
  coachMode: 'visible',
  opponents: 5,
  startingBB: 100,
  autoNext: false,
});

function fresh(): AppData {
  return {
    version: 1,
    play: emptyPlay(),
    quizzes: { preflop: emptyQuiz(), outs: emptyQuiz(), potodds: emptyQuiz(), winner: emptyQuiz(), equity: emptyQuiz() },
    settings: defaultSettings(),
  };
}

function load(): AppData {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      version: 1,
      play: { ...base.play, ...parsed.play, coach: { ...base.play.coach, ...parsed.play?.coach } },
      quizzes: Object.fromEntries(
        (Object.keys(base.quizzes) as QuizId[]).map((k) => [k, { ...base.quizzes[k], ...parsed.quizzes?.[k] }]),
      ) as Record<QuizId, QuizStats>,
      settings: { ...base.settings, ...parsed.settings },
    };
  } catch {
    return base;
  }
}

let data: AppData = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Stockage indisponible : on garde les données en mémoire.
  }
}

function emit() {
  for (const l of listeners) l();
}

export function update(fn: (d: AppData) => AppData) {
  data = fn(data);
  save();
  emit();
}

export function getData(): AppData {
  return data;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData, getData);
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const d = useAppData();
  return [d.settings, (patch) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }))];
}

export function recordQuiz(id: QuizId, ok: boolean) {
  update((d) => {
    const q = d.quizzes[id];
    const streak = ok ? q.streak + 1 : 0;
    return {
      ...d,
      quizzes: {
        ...d.quizzes,
        [id]: {
          attempts: q.attempts + 1,
          correct: q.correct + (ok ? 1 : 0),
          streak,
          bestStreak: Math.max(q.bestStreak, streak),
          recent: [...q.recent, ok].slice(-50),
        },
      },
    };
  });
}

export interface HandRecord {
  netBB: number;
  won: boolean;
  vpip: boolean;
  pfr: boolean;
  sawFlop: boolean;
  showdown: boolean;
  wonShowdown: boolean;
  potBB: number;
}

export function recordHand(h: HandRecord) {
  update((d) => {
    const p = d.play;
    const netBB = Math.round((p.netBB + h.netBB) * 10) / 10;
    return {
      ...d,
      play: {
        ...p,
        hands: p.hands + 1,
        handsWon: p.handsWon + (h.won ? 1 : 0),
        netBB,
        vpip: p.vpip + (h.vpip ? 1 : 0),
        pfr: p.pfr + (h.pfr ? 1 : 0),
        sawFlop: p.sawFlop + (h.sawFlop ? 1 : 0),
        showdowns: p.showdowns + (h.showdown ? 1 : 0),
        showdownsWon: p.showdownsWon + (h.wonShowdown ? 1 : 0),
        curve: [...p.curve, netBB].slice(-300),
        biggestPotBB: Math.max(p.biggestPotBB, h.potBB),
      },
    };
  });
}

export function recordCoach(verdict: 'bon' | 'discutable' | 'erreur') {
  update((d) => ({
    ...d,
    play: { ...d.play, coach: { ...d.play.coach, [verdict]: d.play.coach[verdict] + 1 } },
  }));
}

export function resetStats(what: 'play' | 'quizzes' | 'all') {
  update((d) => {
    const f = fresh();
    return {
      ...d,
      play: what === 'quizzes' ? d.play : f.play,
      quizzes: what === 'play' ? d.quizzes : f.quizzes,
    };
  });
}
