import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../engine/game';
import { callTable, ensureUser, OnlineError, serverNow, supabase } from './client';
import type { PublicTable } from './logic';
import type { RoomStatus } from './service';

export interface RoomRow {
  id: string;
  code: string;
  host: string;
  max_seats: number;
  bots: boolean;
  status: RoomStatus;
  version: number;
  public: PublicTable | null;
  members_at: string;
}

export interface MemberRow {
  user_id: string;
  seat: number;
  name: string;
  away: boolean;
}

export interface HandRow {
  user_id: string;
  hand: number;
  cards: number[];
}

export interface OnlineRoom {
  phase: 'connexion' | 'pret' | 'erreur' | 'fermee';
  error: string | null;
  me: string | null;
  room: RoomRow | null;
  members: MemberRow[];
  hand: HandRow | null;
}

const message = (e: unknown) => (e instanceof OnlineError ? e.message : 'Connexion au serveur de jeu impossible.');

/**
 * Une table en ligne : rejoint la table du code donné, suit son état en temps réel
 * et fait avancer la partie (bots, temps écoulés, main suivante) quand c'est l'heure.
 */
export function useOnlineRoom(code: string, name: string | null) {
  const [state, setState] = useState<OnlineRoom>({ phase: 'connexion', error: null, me: null, room: null, members: [], hand: null });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const roomRef = useRef<RoomRow | null>(null);
  const resyncRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let poll: number | undefined;
    const sb = supabase();

    const setRoom = (room: RoomRow | null) => {
      roomRef.current = room;
      setState((s) => ({ ...s, room }));
    };

    (async () => {
      try {
        setState((s) => ({ ...s, phase: 'connexion', error: null }));
        const me = await ensureUser();
        const res = await callTable({ action: 'rejoindre', code, name });
        const roomId = res.roomId!;

        const loadRoom = async () => {
          const { data, error } = await sb.from('rooms').select('*').eq('id', roomId).maybeSingle();
          if (cancelled || error) return;
          if (!data) {
            setState((s) => ({ ...s, phase: 'fermee' }));
            return;
          }
          const cur = roomRef.current;
          if (!cur || data.version >= cur.version) setRoom(data as RoomRow);
        };
        const loadMembers = async () => {
          const { data } = await sb.from('room_members').select('user_id, seat, name, away').eq('room_id', roomId).order('seat');
          if (!cancelled && data) setState((s) => ({ ...s, members: data as MemberRow[] }));
        };
        const loadHand = async () => {
          const { data } = await sb.from('room_hands').select('user_id, hand, cards').eq('room_id', roomId).eq('user_id', me).maybeSingle();
          if (!cancelled) setState((s) => ({ ...s, hand: (data as HandRow) ?? null }));
        };
        const resync = () => void Promise.all([loadRoom(), loadMembers(), loadHand()]);
        resyncRef.current = resync;

        await Promise.all([loadRoom(), loadMembers(), loadHand()]);
        if (cancelled) return;
        setState((s) => ({ ...s, me, phase: 'pret' }));

        channel = sb
          .channel(`table:${roomId}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (p: RealtimePostgresChangesPayload<RoomRow>) => {
            const next = p.new as RoomRow;
            const cur = roomRef.current;
            if (!cur || next.version < cur.version) return;
            if (next.members_at !== cur.members_at) void loadMembers();
            // Une colonne volumineuse inchangée peut manquer dans l'événement : on garde la précédente.
            const fresh = next.version !== cur.version;
            if (fresh && (!next.public || typeof next.public !== 'object')) {
              void loadRoom();
              return;
            }
            setRoom({ ...cur, ...next, public: fresh ? next.public : cur.public });
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
            setState((s) => ({ ...s, phase: 'fermee' }));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'room_hands', filter: `room_id=eq.${roomId}` }, (p: RealtimePostgresChangesPayload<HandRow>) => {
            const h = p.new as HandRow;
            if (h?.user_id === me) setState((s) => ({ ...s, hand: h }));
          })
          .subscribe((status) => {
            // Abonnement (ré)établi : on relit tout, au cas où un événement aurait été manqué.
            if (status === 'SUBSCRIBED') resync();
          });
        // Filet de sécurité si le temps réel est coupé.
        poll = window.setInterval(resync, 15_000);
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, phase: 'erreur', error: message(e) }));
      }
    })();

    return () => {
      cancelled = true;
      if (channel) void sb.removeChannel(channel);
      window.clearInterval(poll);
      roomRef.current = null;
    };
  }, [code, name]);

  // Étape automatique due (bot, temps écoulé, main suivante) : chaque navigateur la demande,
  // dans l'ordre des sièges, et le serveur ne l'applique qu'une fois.
  const room = state.room;
  const nextAt = room?.status === 'en-cours' ? room.public?.nextAt ?? null : null;
  useEffect(() => {
    if (!room || nextAt === null || !state.me) return;
    const present = (room.public?.seats ?? []).filter((s) => s.userId && !s.away);
    let rank = present.findIndex((s) => s.userId === state.me);
    if (rank < 0) rank = present.length;
    const delay = Math.max(0, Math.max(nextAt, retryAt) - serverNow()) + 120 + rank * 450;
    const t = window.setTimeout(async () => {
      try {
        const r = await callTable({ action: 'avancer', roomId: room.id });
        // Pas encore l'heure pour le serveur (horloges décalées) : on réessaie à son heure.
        if (!r.changed && r.nextAt && r.nextAt > serverNow()) setRetryAt(r.nextAt);
      } catch {
        // le prochain événement ou la relecture périodique relancera l'étape
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [room?.id, room?.version, nextAt, retryAt, state.me]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(message(e));
      resyncRef.current();
    } finally {
      setBusy(false);
    }
  }, []);

  const roomId = room?.id ?? '';
  return {
    state,
    busy,
    actionError,
    clearError: () => setActionError(null),
    play: (move: Action) => run(() => callTable({ action: 'jouer', roomId, move })),
    launch: () => run(() => callTable({ action: 'lancer', roomId })),
    replay: () => run(() => callTable({ action: 'rejouer', roomId })),
    leave: () => run(() => callTable({ action: 'quitter', roomId })),
  };
}
