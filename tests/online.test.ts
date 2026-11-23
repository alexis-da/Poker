import { describe, expect, it } from 'vitest';
import { getLegalActions, type Action } from '../src/engine/game';
import { seededRng, type Rng } from '../src/engine/random';
import { blindLevel, HANDS_PER_LEVEL, HIDDEN, newTable, START_STACK, step, TURN_MS, type PublicTable, type ServerTable } from '../src/online/logic';
import { handle, type HandRecord, type MemberRecord, type RoomRecord, type RoomStatus, type Store } from '../src/online/service';

/** Base en mémoire, avec le même contrat que la base Supabase. */
class MemoryStore implements Store {
  rooms = new Map<string, RoomRecord>();
  memberRows = new Map<string, MemberRecord[]>();
  secrets = new Map<string, ServerTable>();
  publics = new Map<string, PublicTable>();
  hands = new Map<string, HandRecord>();
  private n = 0;
  async findRoomByCode(code: string) {
    return [...this.rooms.values()].find((r) => r.code === code) ?? null;
  }
  async getRoom(id: string) {
    const r = this.rooms.get(id);
    return r ? { ...r } : null;
  }
  async insertRoom(room: Omit<RoomRecord, 'id' | 'version'>) {
    if ([...this.rooms.values()].some((r) => r.code === room.code)) return null;
    const r = { ...room, id: `room-${++this.n}`, version: 0 };
    this.rooms.set(r.id, r);
    this.memberRows.set(r.id, []);
    return { ...r };
  }
  async setHost(roomId: string, host: string) {
    this.rooms.get(roomId)!.host = host;
  }
  async deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }
  async members(roomId: string) {
    return (this.memberRows.get(roomId) ?? []).map((m) => ({ ...m }));
  }
  async insertMember(roomId: string, m: MemberRecord) {
    const rows = this.memberRows.get(roomId)!;
    if (rows.some((x) => x.seat === m.seat || x.userId === m.userId)) return false;
    rows.push({ ...m });
    return true;
  }
  async updateMember(roomId: string, userId: string, patch: Partial<MemberRecord>) {
    Object.assign(this.memberRows.get(roomId)!.find((m) => m.userId === userId)!, patch);
  }
  async deleteMember(roomId: string, userId: string) {
    this.memberRows.set(roomId, this.memberRows.get(roomId)!.filter((m) => m.userId !== userId));
  }
  async loadTable(roomId: string) {
    const t = this.secrets.get(roomId);
    return t ? structuredClone(t) : null;
  }
  async saveTable(roomId: string, v: number, status: RoomStatus, pub: PublicTable, secret: ServerTable, hands: HandRecord[] | null) {
    const r = this.rooms.get(roomId)!;
    if (r.version !== v) return false;
    r.version++;
    r.status = status;
    this.publics.set(roomId, structuredClone(pub));
    this.secrets.set(roomId, structuredClone(secret));
    for (const h of hands ?? []) this.hands.set(`${roomId}:${h.userId}`, { ...h });
    return true;
  }
}

/** Jetons en jeu : tapis, plus les mises tant que le pot n'est pas distribué. */
const total = (t: ServerTable) => t.game.players.reduce((a, p) => a + p.stack + (t.game.result ? 0 : p.contributed), 0);

/** Action légale au hasard pour un joueur réel. */
function randomMove(t: ServerTable, rng: Rng): Action {
  const legal = getLegalActions(t.game)!;
  const r = rng();
  if (r < 0.15 && !legal.canCheck) return { type: 'fold' };
  if (r < 0.3 && legal.canRaise) return { type: 'raise', amount: legal.minRaiseTo + Math.floor(rng() * (legal.maxRaiseTo - legal.minRaiseTo + 1)) };
  return { type: 'call' };
}

async function setup(bots: boolean, maxSeats = 4) {
  const store = new MemoryStore();
  const rng = seededRng(7);
  let now = 1_000_000;
  const { roomId, code } = await handle(store, 'alice', { action: 'creer', name: 'Alice', maxSeats, bots }, now, rng);
  await handle(store, 'bruno', { action: 'rejoindre', code: code!.toLowerCase(), name: '  Bruno ' }, now, rng);
  return { store, rng, roomId: roomId!, code: code!, now };
}

describe('jeu en ligne', () => {
  it('crée une table, fait asseoir les joueurs et complète avec des bots', async () => {
    const { store, rng, roomId, now } = await setup(true);
    expect((await store.members(roomId)).map((m) => [m.seat, m.name])).toEqual([
      [0, 'Alice'],
      [1, 'Bruno'],
    ]);
    await expect(handle(store, 'bruno', { action: 'lancer', roomId }, now, rng)).rejects.toThrow(/hôte/);
    await handle(store, 'alice', { action: 'lancer', roomId }, now, rng);
    const t = store.secrets.get(roomId)!;
    expect(t.seats).toHaveLength(4);
    expect(t.seats.filter((s) => s.bot)).toHaveLength(2);
    expect(total(t)).toBe(4 * START_STACK);
    expect(store.rooms.get(roomId)!.status).toBe('en-cours');
    // Chacun reçoit ses deux cartes, et seulement les siennes.
    for (const u of ['alice', 'bruno']) {
      const h = store.hands.get(`${roomId}:${u}`)!;
      const i = t.seats.findIndex((s) => s.userId === u);
      expect(h.cards).toEqual(t.game.players[i].hole);
    }
    await expect(handle(store, 'chloe', { action: 'rejoindre', code: store.rooms.get(roomId)!.code, name: 'Chloé' }, now, rng)).rejects.toThrow(
      /déjà commencé/,
    );
  });

  it('refuse de jouer hors de son tour et sans bots il faut deux joueurs', async () => {
    const store = new MemoryStore();
    const rng = seededRng(3);
    const { roomId, code } = await handle(store, 'alice', { action: 'creer', name: 'Alice', maxSeats: 2, bots: false }, 0, rng);
    await expect(handle(store, 'alice', { action: 'lancer', roomId: roomId! }, 0, rng)).rejects.toThrow(/au moins un autre joueur/);
    await handle(store, 'bruno', { action: 'rejoindre', code: code!, name: 'Bruno' }, 0, rng);
    await expect(handle(store, 'chloe', { action: 'rejoindre', code: code!, name: 'Chloé' }, 0, rng)).rejects.toThrow(/complète/);
    await handle(store, 'alice', { action: 'lancer', roomId: roomId! }, 0, rng);
    const t = store.secrets.get(roomId!)!;
    const notMe = t.seats[t.game.toAct!].userId === 'alice' ? 'bruno' : 'alice';
    await expect(handle(store, notMe, { action: 'jouer', roomId: roomId!, move: { type: 'call' } }, 0, rng)).rejects.toThrow(/pas à vous/);
    await expect(handle(store, 'zoe', { action: 'jouer', roomId: roomId!, move: { type: 'call' } }, 0, rng)).rejects.toThrow(/pas assis/);
  });

  it('joue des parties complètes sans perdre de jetons ni dévoiler de cartes', async () => {
    const lengths: number[] = [];
    for (const seed of [1, 2, 3]) {
      const { store, roomId } = await setup(true, 6);
      const rng = seededRng(seed * 101);
      let now = 5_000_000;
      await handle(store, 'alice', { action: 'lancer', roomId }, now, rng);
      let steps = 0;
      while (store.rooms.get(roomId)!.status === 'en-cours' && steps < 6000) {
        steps++;
        const t = store.secrets.get(roomId)!;
        const pub = store.publics.get(roomId)!;
        expect(total(t)).toBe(6 * START_STACK);
        // Vue publique : aucune carte cachée n'apparaît, aucun paquet.
        expect(pub.game.deck).toEqual([]);
        pub.game.players.forEach((p, i) => {
          if (!p.shown) expect(p.hole.every((c) => c === HIDDEN)).toBe(true);
          else expect(p.hole).toEqual(t.game.players[i].hole);
        });
        const g = t.game;
        const actor = !g.result && g.toAct !== null ? t.seats[g.toAct] : null;
        if (actor?.userId && !actor.away) {
          await handle(store, actor.userId, { action: 'jouer', roomId, move: randomMove(t, rng) }, now, rng);
        } else {
          now = Math.max(now, t.nextAt ?? now);
          await handle(store, 'bruno', { action: 'avancer', roomId }, now, rng);
        }
        now += 50;
      }
      const t = store.secrets.get(roomId)!;
      // Les blindes ont monté au fil des niveaux.
      expect(t.game.bigBlind).toBe(blindLevel(t.game.handNumber).bigBlind);
      lengths.push(t.game.handNumber);
      expect(store.rooms.get(roomId)!.status).toBe('terminee');
      expect(t.over).toBe(true);
      expect(total(t)).toBe(6 * START_STACK);
      // Un classement complet, sans doublon de place.
      const places = t.eliminations.map((e) => e.place).sort((a, b) => a - b);
      expect(new Set(places).size).toBe(places.length);
      expect(places[0]).toBe(1);
    }
  });

  it('les blindes montent d’un niveau toutes les 6 mains', () => {
    expect(blindLevel(1)).toMatchObject({ level: 1, smallBlind: 5, bigBlind: 10, handsLeft: HANDS_PER_LEVEL });
    expect(blindLevel(HANDS_PER_LEVEL)).toMatchObject({ level: 1, handsLeft: 1 });
    expect(blindLevel(HANDS_PER_LEVEL + 1)).toMatchObject({ level: 2, smallBlind: 10, bigBlind: 20 });
    expect(blindLevel(4 * HANDS_PER_LEVEL + 1)).toMatchObject({ level: 5, bigBlind: 100 });
    expect(blindLevel(10_000).last).toBe(true);
  });

  it('une main terminée dès la donne (tapis sur les blindes) élimine et termine la partie', () => {
    const rng = seededRng(11);
    const seats = [
      { userId: 'a', bot: null, name: 'A', away: false },
      { userId: 'b', bot: null, name: 'B', away: false },
    ];
    let t = newTable(seats, rng, 0);
    // Fin de main forcée : B n'a plus que 3 jetons, moins que la petite blinde suivante.
    t = { ...t, game: { ...t.game, result: t.game.result ?? ({} as never), players: t.game.players.map((p, i) => ({ ...p, stack: i === 0 ? 2 * START_STACK - 3 : 3, contributed: 0 })) } };
    let guard = 0;
    while (!t.over && guard++ < 50) t = step(t, t.nextAt ?? 0, rng) ?? t;
    expect(t.over).toBe(true);
    expect(t.eliminations.map((e) => e.place).sort()).toEqual([1, 2]);
  });

  it('une étape automatique n’est jouée qu’à son heure, une seule fois', async () => {
    const { store, rng, roomId } = await setup(false, 2);
    let now = 10_000;
    await handle(store, 'alice', { action: 'lancer', roomId }, now, rng);
    const r1 = await handle(store, 'bruno', { action: 'avancer', roomId }, now + 1000, rng);
    expect(r1.changed).toBe(false);
    const t = store.secrets.get(roomId)!;
    const who = t.seats[t.game.toAct!].userId!;
    // Temps écoulé : on se couche ou on checke à sa place.
    now += TURN_MS + 1;
    const r2 = await handle(store, 'alice', { action: 'avancer', roomId }, now, rng);
    expect(r2.changed).toBe(true);
    const after = store.secrets.get(roomId)!;
    expect(after.timeouts[who]).toBe(1);
    const r3 = await handle(store, 'bruno', { action: 'avancer', roomId }, now, rng);
    expect(r3.changed).toBe(false);
  });

  it('un joueur qui quitte est joué automatiquement, puis peut revenir ; l’hôte peut rejouer', async () => {
    const { store, rng, roomId, code } = await setup(true, 3);
    let now = 0;
    await handle(store, 'alice', { action: 'lancer', roomId }, now, rng);
    await handle(store, 'bruno', { action: 'quitter', roomId }, now, rng);
    expect(store.secrets.get(roomId)!.seats.find((s) => s.userId === 'bruno')!.away).toBe(true);
    expect((await store.members(roomId)).find((m) => m.userId === 'bruno')!.away).toBe(true);
    await handle(store, 'bruno', { action: 'rejoindre', code, name: 'Bruno' }, now, rng);
    expect(store.secrets.get(roomId)!.seats.find((s) => s.userId === 'bruno')!.away).toBe(false);
    // Les deux joueurs réels partent : la partie s'arrête.
    await handle(store, 'alice', { action: 'quitter', roomId }, now, rng);
    await handle(store, 'bruno', { action: 'quitter', roomId }, now, rng);
    expect(store.rooms.get(roomId)!.status).toBe('terminee');
    await handle(store, 'alice', { action: 'rejoindre', code, name: 'Alice' }, now, rng);
    now += 1;
    await handle(store, 'alice', { action: 'rejouer', roomId }, now, rng);
    const t = store.secrets.get(roomId)!;
    expect(store.rooms.get(roomId)!.status).toBe('en-cours');
    expect(t.game.handNumber).toBe(1);
    expect(t.seats.every((s) => !s.away)).toBe(true);
    expect(total(t)).toBe(3 * START_STACK);
  });

  it('en salle d’attente, l’hôte qui part transmet la table', async () => {
    const { store, rng, roomId } = await setup(false, 4);
    await handle(store, 'alice', { action: 'quitter', roomId }, 0, rng);
    expect(store.rooms.get(roomId)!.host).toBe('bruno');
    await handle(store, 'bruno', { action: 'quitter', roomId }, 0, rng);
    expect(store.rooms.has(roomId)).toBe(false);
  });
});
