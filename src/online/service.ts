import type { Action } from '../engine/game';
import type { Rng } from '../engine/random';
import {
  botSeats,
  newTable,
  playerAction,
  privateHands,
  publicView,
  setAway,
  step,
  TableError,
  type PublicTable,
  type Seat,
  type ServerTable,
} from './logic';

export { TableError } from './logic';

/**
 * Service de jeu en ligne : une requête d'un joueur authentifié → lecture, règles, écriture.
 * Le stockage est abstrait (Supabase en production, mémoire dans les tests).
 */

export type RoomStatus = 'attente' | 'en-cours' | 'terminee';

export interface RoomRecord {
  id: string;
  code: string;
  host: string;
  maxSeats: number;
  bots: boolean;
  status: RoomStatus;
  version: number;
}

export interface MemberRecord {
  userId: string;
  seat: number;
  name: string;
  away: boolean;
}

export interface HandRecord {
  userId: string;
  hand: number;
  cards: number[];
}

export interface Store {
  findRoomByCode(code: string): Promise<RoomRecord | null>;
  getRoom(id: string): Promise<RoomRecord | null>;
  /** null si le code est déjà pris. */
  insertRoom(room: Omit<RoomRecord, 'id' | 'version'>): Promise<RoomRecord | null>;
  setHost(roomId: string, host: string): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  members(roomId: string): Promise<MemberRecord[]>;
  /** false si la place ou le joueur est déjà pris. */
  insertMember(roomId: string, m: MemberRecord): Promise<boolean>;
  updateMember(roomId: string, userId: string, patch: Partial<Pick<MemberRecord, 'away' | 'name'>>): Promise<void>;
  deleteMember(roomId: string, userId: string): Promise<void>;
  loadTable(roomId: string): Promise<ServerTable | null>;
  /** Écrit l'état si la version n'a pas changé entre-temps ; false sinon. */
  saveTable(
    roomId: string,
    expectedVersion: number,
    status: RoomStatus,
    pub: PublicTable,
    secret: ServerTable,
    hands: HandRecord[] | null,
  ): Promise<boolean>;
}

export type Request =
  | { action: 'creer'; name: string; maxSeats: number; bots: boolean }
  | { action: 'rejoindre'; code: string; name: string }
  | { action: 'quitter'; roomId: string }
  | { action: 'lancer'; roomId: string }
  | { action: 'jouer'; roomId: string; move: Action }
  | { action: 'avancer'; roomId: string }
  | { action: 'rejouer'; roomId: string };

export type Response = { roomId?: string; code?: string; changed?: boolean; nextAt?: number | null };

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

export function normalizeCode(code: string): string {
  return String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
}

export function cleanName(name: string): string {
  const n = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
  if (!n) throw new TableError('Choisissez un pseudo.');
  return n;
}

function newCode(rng: Rng): string {
  let c = '';
  for (let i = 0; i < CODE_LENGTH; i++) c += CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)];
  return c;
}

async function roomOf(store: Store, roomId: string): Promise<RoomRecord> {
  const room = await store.getRoom(String(roomId ?? ''));
  if (!room) throw new TableError('Cette table n’existe plus.');
  return room;
}

async function memberOf(store: Store, room: RoomRecord, userId: string): Promise<MemberRecord> {
  const m = (await store.members(room.id)).find((x) => x.userId === userId);
  if (!m) throw new TableError('Vous n’êtes pas assis à cette table.');
  return m;
}

function statusOf(t: ServerTable): RoomStatus {
  return t.over ? 'terminee' : 'en-cours';
}

/** Écrit un nouvel état ; les cartes privées ne sont réécrites qu'à chaque nouvelle main. */
async function save(store: Store, room: RoomRecord, before: ServerTable | null, after: ServerTable): Promise<boolean> {
  const dealt = !before || before.game.handNumber !== after.game.handNumber;
  return store.saveTable(room.id, room.version, statusOf(after), publicView(after), after, dealt ? privateHands(after) : null);
}

/** Relit et réapplique une modification tant qu'un autre joueur écrit en même temps. */
async function mutate(
  store: Store,
  roomId: string,
  change: (room: RoomRecord, t: ServerTable) => ServerTable | null,
): Promise<{ changed: boolean; table: ServerTable | null }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const room = await roomOf(store, roomId);
    const t = await store.loadTable(room.id);
    if (!t) throw new TableError('La partie n’a pas encore commencé.');
    const next = change(room, t);
    if (!next) return { changed: false, table: t };
    if (await save(store, room, t, next)) return { changed: true, table: next };
  }
  throw new TableError('La table est très sollicitée, réessayez.');
}

async function seatsForGame(store: Store, room: RoomRecord, rng: Rng): Promise<Seat[]> {
  const members = (await store.members(room.id)).sort((a, b) => a.seat - b.seat);
  const seats: Seat[] = members.map((m) => ({ userId: m.userId, bot: null, name: m.name, away: false }));
  if (room.bots && seats.length < room.maxSeats) {
    seats.push(...botSeats(room.maxSeats - seats.length, seats.map((s) => s.name), rng));
  }
  if (seats.length < 2) throw new TableError('Attendez au moins un autre joueur, ou activez les bots.');
  return seats;
}

export async function handle(store: Store, userId: string, req: Request, now: number, rng: Rng): Promise<Response> {
  switch (req.action) {
    case 'creer': {
      const name = cleanName(req.name);
      const maxSeats = Math.max(2, Math.min(6, Math.round(Number(req.maxSeats) || 6)));
      for (let attempt = 0; attempt < 8; attempt++) {
        const room = await store.insertRoom({ code: newCode(rng), host: userId, maxSeats, bots: !!req.bots, status: 'attente' });
        if (!room) continue;
        await store.insertMember(room.id, { userId, seat: 0, name, away: false });
        return { roomId: room.id, code: room.code };
      }
      throw new TableError('Impossible de créer la table, réessayez.');
    }

    case 'rejoindre': {
      const name = cleanName(req.name);
      const room = await store.findRoomByCode(normalizeCode(req.code));
      if (!room) throw new TableError('Aucune table avec ce code.');
      const members = await store.members(room.id);
      const me = members.find((m) => m.userId === userId);
      if (me) {
        // Retour à la table : on reprend sa place.
        if (me.away || me.name !== name) await store.updateMember(room.id, userId, { away: false, ...(room.status === 'attente' ? { name } : {}) });
        if (room.status === 'en-cours') await mutate(store, room.id, (_r, t) => (t.seats.find((s) => s.userId === userId)?.away ? setAway(t, userId, false, now) : null));
        return { roomId: room.id, code: room.code };
      }
      // On s'assoit en salle d'attente, ou entre deux parties (pour la suivante).
      if (room.status === 'en-cours') throw new TableError('La partie a déjà commencé à cette table : attendez la fin de la partie.');
      for (let attempt = 0; attempt < 4; attempt++) {
        const taken = new Set((await store.members(room.id)).map((m) => m.seat));
        let seat = 0;
        while (taken.has(seat)) seat++;
        if (seat >= room.maxSeats) throw new TableError('La table est complète.');
        if (await store.insertMember(room.id, { userId, seat, name, away: false })) return { roomId: room.id, code: room.code };
      }
      throw new TableError('Impossible de rejoindre la table, réessayez.');
    }

    case 'quitter': {
      const room = await roomOf(store, req.roomId);
      await memberOf(store, room, userId);
      if (room.status === 'attente') {
        await store.deleteMember(room.id, userId);
        if (room.host === userId) {
          const rest = (await store.members(room.id)).sort((a, b) => a.seat - b.seat);
          if (rest.length) await store.setHost(room.id, rest[0].userId);
          else await store.deleteRoom(room.id);
        }
        return { changed: true };
      }
      await store.updateMember(room.id, userId, { away: true });
      if (room.status === 'en-cours') await mutate(store, room.id, (_r, t) => setAway(t, userId, true, now));
      return { changed: true };
    }

    case 'lancer':
    case 'rejouer': {
      const room = await roomOf(store, req.roomId);
      if (room.host !== userId) throw new TableError('Seul l’hôte de la table peut lancer la partie.');
      if (req.action === 'lancer' && room.status !== 'attente') throw new TableError('La partie est déjà lancée.');
      if (req.action === 'rejouer' && room.status !== 'terminee') throw new TableError('La partie n’est pas terminée.');
      const before = req.action === 'rejouer' ? await store.loadTable(room.id) : null;
      const t = newTable(await seatsForGame(store, room, rng), rng, now);
      if (req.action === 'rejouer') {
        for (const m of await store.members(room.id)) if (m.away) await store.updateMember(room.id, m.userId, { away: false });
      }
      // Une nouvelle partie repart à la main 1 : les cartes privées sont toujours réécrites.
      const ok = await store.saveTable(room.id, room.version, 'en-cours', publicView(t), t, privateHands(t));
      if (!ok && !before) throw new TableError('La partie vient d’être lancée.');
      return { changed: ok, nextAt: t.nextAt };
    }

    case 'jouer': {
      const room = await roomOf(store, req.roomId);
      await memberOf(store, room, userId);
      const { table } = await mutate(store, room.id, (_r, t) => playerAction(t, userId, req.move, now));
      return { changed: true, nextAt: table?.nextAt ?? null };
    }

    case 'avancer': {
      const room = await roomOf(store, req.roomId);
      await memberOf(store, room, userId);
      if (room.status !== 'en-cours') return { changed: false, nextAt: null };
      const { changed, table } = await mutate(store, room.id, (_r, t) => step(t, now, rng));
      return { changed, nextAt: table?.nextAt ?? null };
    }

    default:
      throw new TableError('Requête inconnue.');
  }
}
