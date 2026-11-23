import Dexie, { type Table } from 'dexie';
import { useSyncExternalStore } from 'react';
import type { TrainingEvent } from './model';

/**
 * Base de données de l'historique d'entraînement.
 *
 * - « compte » : la base de l'artefact (capacité `db` de claude.ai), dans l'espace privé du
 *   joueur (`data/users/<id>/`), synchronisée entre ses appareils. Les événements sont regroupés
 *   en un document par jour et par appareil, pour rester loin du plafond de documents et éviter
 *   que deux appareils écrivent le même document.
 * - « appareil » : IndexedDB via Dexie, quand l'application tourne hors de claude.ai ou que la
 *   base du compte n'est pas disponible.
 * - « mémoire » : dernier recours (navigation privée stricte) ; rien n'est conservé.
 */

export type BackendKind = 'compte' | 'appareil' | 'memoire';

interface Backend {
  kind: BackendKind;
  load(): Promise<TrainingEvent[]>;
  append(e: TrainingEvent): Promise<void>;
  importAll(events: TrainingEvent[]): Promise<void>;
  clear(): Promise<void>;
}

export interface TrainingState {
  status: 'chargement' | 'pret';
  backend: BackendKind;
  events: TrainingEvent[];
  error: string | null;
}

const KEEP_DAYS = 120;
const DAY = 86_400_000;
const MAX_PER_DOC = 1200;

// ——— État observable ———

let state: TrainingState = { status: 'chargement', backend: 'memoire', events: [], error: null };
const listeners = new Set<() => void>();
const setState = (patch: Partial<TrainingState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useTraining(): TrainingState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export const getTraining = () => state;

// ——— Moteur « appareil » : IndexedDB ———

class LocalDB extends Dexie {
  events!: Table<TrainingEvent & { id?: number }, number>;
  constructor() {
    super('coach-holdem');
    this.version(1).stores({ events: '++id, t, skill' });
  }
}

async function openLocal(): Promise<Backend> {
  try {
    const db = new LocalDB();
    await db.open();
    return {
      kind: 'appareil',
      load: async () =>
        (await db.events.where('t').above(Date.now() - KEEP_DAYS * DAY).toArray()).map(({ id: _id, ...e }) => e),
      append: async (e) => {
        await db.events.add({ ...e });
      },
      importAll: async (events) => {
        await db.events.bulkAdd(events.map((e) => ({ ...e })));
      },
      clear: async () => {
        await db.events.clear();
      },
    };
  } catch {
    return memoryBackend();
  }
}

function memoryBackend(): Backend {
  return { kind: 'memoire', load: async () => [], append: async () => {}, importAll: async () => {}, clear: async () => {} };
}

// ——— Moteur « compte » : base de l'artefact ———

type DbDoc = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type DbCollection = {
  doc(id?: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
  orderBy(f: string, dir?: 'asc' | 'desc'): { limit(n: number): { get(): Promise<{ docs: DbDoc[] }> } };
  get(): Promise<{ docs: DbDoc[] }>;
};
type ClaudeRuntime = { use(name: string): Promise<unknown> };

function deviceId(): string {
  const make = () => Math.random().toString(36).slice(2, 8);
  try {
    let id = localStorage.getItem('coach-holdem:device');
    if (!id) {
      id = make();
      localStorage.setItem('coach-holdem:device', id);
    }
    return id;
  } catch {
    return make();
  }
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function isEvent(x: unknown): x is TrainingEvent {
  const e = x as TrainingEvent;
  return !!e && typeof e.t === 'number' && typeof e.skill === 'string' && (e.ok === 0 || e.ok === 0.5 || e.ok === 1);
}

async function openCloud(): Promise<Backend | null> {
  const runtime = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (!runtime?.use) return null;
  const [db, user] = (await Promise.all([runtime.use('db'), runtime.use('user')])) as [
    { collection(path: string): DbCollection } | null,
    { id(): Promise<string | null> } | null,
  ];
  if (!db || !user) return null;
  const uid = await user.id();
  if (!uid) return null;
  const col = db.collection(`data/users/${uid}`);
  const device = deviceId();
  // Document du jour de cet appareil, tenu en mémoire et réécrit en entier à chaque ajout.
  let current: { day: string; part: number; events: TrainingEvent[] } | null = null;
  let writing: Promise<void> = Promise.resolve();

  const docFor = (day: string, part: number) => `log-${day}-${device}${part ? `-${part}` : ''}`;
  const write = (day: string, part: number, events: TrainingEvent[]) => {
    const body = { kind: 'log', day, device, part, events: events.map((e) => ({ ...e })) };
    writing = writing.then(() => col.doc(docFor(day, part)).set(body));
    return writing;
  };

  return {
    kind: 'compte',
    load: async () => {
      const snap = await col.orderBy('day', 'desc').limit(KEEP_DAYS * 2).get();
      const events: TrainingEvent[] = [];
      for (const d of snap.docs) {
        const body = d.data();
        if (!body || body.kind !== 'log' || !Array.isArray(body.events)) continue;
        const evs = (body.events as unknown[]).filter(isEvent);
        events.push(...evs);
        const part = typeof body.part === 'number' ? body.part : 0;
        if (body.device === device && body.day === dayKey(Date.now()) && (!current || part > current.part)) {
          current = { day: body.day as string, part, events: evs.slice() };
        }
      }
      return events;
    },
    append: async (e) => {
      const day = dayKey(e.t);
      if (!current || current.day !== day) current = { day, part: 0, events: [] };
      if (current.events.length >= MAX_PER_DOC) current = { day, part: current.part + 1, events: [] };
      current.events.push(e);
      await write(current.day, current.part, current.events);
    },
    importAll: async (events) => {
      const byDay = new Map<string, TrainingEvent[]>();
      for (const e of events) {
        const k = dayKey(e.t);
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k)!.push(e);
      }
      for (const [day, evs] of byDay) await write(day, 0, evs.slice(-MAX_PER_DOC));
    },
    clear: async () => {
      const snap = await col.get();
      for (const d of snap.docs) await col.doc(d.id).delete();
      current = null;
    },
  };
}

// ——— Cycle de vie ———

let backend: Backend = memoryBackend();
let started = false;

const errorText = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  if (code === 'quota_exceeded') return 'La base de données est pleine : effacez l’historique pour continuer à enregistrer.';
  return 'L’historique n’a pas pu être enregistré.';
};

/** Ouvre la base (une seule fois) : d'abord l'appareil, puis le compte si claude.ai le propose. */
export async function initTraining() {
  if (started) return;
  started = true;
  const local = await openLocal();
  backend = local;
  const localEvents = await local.load().catch(() => []);
  setState({ status: 'pret', backend: local.kind, events: localEvents });

  try {
    const cloud = await openCloud();
    if (!cloud) return;
    const cloudEvents = await cloud.load();
    // Première connexion au compte : on y verse l'historique déjà présent sur l'appareil.
    if (cloudEvents.length === 0 && state.events.length > 0) await cloud.importAll(state.events);
    backend = cloud;
    setState({ backend: 'compte', events: cloudEvents.length ? cloudEvents : state.events, error: null });
  } catch {
    // La base du compte ne répond pas : on reste sur l'appareil.
  }
}

/** Ajoute un événement : affiché tout de suite, enregistré en arrière-plan. */
export function logEvent(e: TrainingEvent) {
  setState({ events: [...state.events, e] });
  backend.append(e).catch(async (err) => {
    const code = (err as { code?: string })?.code;
    if (backend.kind === 'compte' && code !== 'quota_exceeded') {
      // Écriture refusée (droits, réseau) : repli sur l'appareil.
      backend = await openLocal();
      setState({ backend: backend.kind });
      await backend.append(e).catch(() => {});
      return;
    }
    setState({ error: errorText(err) });
  });
}

export async function clearTraining() {
  await backend.clear().catch(() => {});
  setState({ events: [], error: null });
}
