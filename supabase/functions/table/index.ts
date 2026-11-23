// Fonction Supabase « table » : point d'entrée unique du jeu en ligne.
// Elle authentifie le joueur, applique les règles (service.js, généré depuis src/online) et écrit
// avec la clé de service ; les navigateurs ne font que lire, en temps réel, ce qu'on leur autorise.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, TableError } from './service.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Tirage cryptographique pour le mélange des cartes. */
function rng(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

type Row = Record<string, unknown>;

const room = (r: Row) => ({
  id: r.id as string,
  code: r.code as string,
  host: r.host as string,
  maxSeats: r.max_seats as number,
  bots: r.bots as boolean,
  status: r.status as string,
  version: r.version as number,
});

const ROOM_COLUMNS = 'id, code, host, max_seats, bots, status, version';

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const store = {
  async findRoomByCode(code: string) {
    const r = check(await admin.from('rooms').select(ROOM_COLUMNS).eq('code', code).maybeSingle());
    return r ? room(r) : null;
  },
  async getRoom(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = check(await admin.from('rooms').select(ROOM_COLUMNS).eq('id', id).maybeSingle());
    return r ? room(r) : null;
  },
  async insertRoom(r: { code: string; host: string; maxSeats: number; bots: boolean; status: string }) {
    const res = await admin
      .from('rooms')
      .insert({ code: r.code, host: r.host, max_seats: r.maxSeats, bots: r.bots, status: r.status })
      .select(ROOM_COLUMNS)
      .single();
    if (res.error?.code === '23505') return null;
    return room(check(res) as Row);
  },
  async setHost(roomId: string, host: string) {
    check(await admin.from('rooms').update({ host }).eq('id', roomId));
  },
  async deleteRoom(roomId: string) {
    check(await admin.from('rooms').delete().eq('id', roomId));
  },
  async members(roomId: string) {
    const rows = check(await admin.from('room_members').select('user_id, seat, name, away').eq('room_id', roomId)) ?? [];
    return rows.map((m: Row) => ({ userId: m.user_id as string, seat: m.seat as number, name: m.name as string, away: m.away as boolean }));
  },
  async insertMember(roomId: string, m: { userId: string; seat: number; name: string; away: boolean }) {
    const res = await admin.from('room_members').insert({ room_id: roomId, user_id: m.userId, seat: m.seat, name: m.name, away: m.away });
    if (res.error?.code === '23505') return false;
    check(res);
    return true;
  },
  async updateMember(roomId: string, userId: string, patch: { away?: boolean; name?: string }) {
    check(await admin.from('room_members').update(patch).eq('room_id', roomId).eq('user_id', userId));
  },
  async deleteMember(roomId: string, userId: string) {
    check(await admin.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId));
  },
  async loadTable(roomId: string) {
    const r = check(await admin.from('room_secrets').select('data').eq('room_id', roomId).maybeSingle());
    return r ? r.data : null;
  },
  async saveTable(roomId: string, version: number, status: string, pub: unknown, secret: unknown, hands: unknown[] | null) {
    const v = check(
      await admin.rpc('save_table', {
        p_room: roomId,
        p_version: version,
        p_status: status,
        p_public: pub,
        p_secret: secret,
        p_hands: hands,
      }),
    );
    return v !== null;
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return json({ error: 'Session expirée : rechargez la page.' }, 401);
  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }
  try {
    if (body.action === 'creer') await admin.rpc('purge_old_rooms');
    const res = await handle(store, data.user.id, body, Date.now(), rng);
    return json({ ...res, serverNow: Date.now() });
  } catch (e) {
    // Erreurs de jeu (pas son tour, table complète…) : message pour le joueur.
    if (e instanceof TableError) return json({ error: e.message, serverNow: Date.now() });
    console.error(e);
    return json({ error: 'Erreur du serveur de jeu, réessayez.' }, 500);
  }
});
