import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request, Response } from './service';

/**
 * Connexion au serveur de jeu en ligne (Supabase). L'URL et la clé « anon » sont publiques :
 * elles identifient le projet, et la sécurité repose sur les règles d'accès de la base.
 */
const URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
const KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const onlineConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'coach-holdem:auth' },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

export class OnlineError extends Error {}

/** Décalage entre l'horloge du serveur et celle de l'appareil. */
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;

/** Identifiant du joueur : session anonyme créée au besoin, conservée dans le navigateur. */
export async function ensureUser(): Promise<string> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: created, error } = await sb.auth.signInAnonymously();
  if (error || !created.user) {
    throw new OnlineError(
      /anonymous/i.test(error?.message ?? '')
        ? 'Les connexions anonymes ne sont pas activées sur le serveur de jeu.'
        : 'Impossible de se connecter au serveur de jeu. Vérifiez votre connexion.',
    );
  }
  return created.user.id;
}

/** Appel à la fonction « table » du serveur. */
export async function callTable(req: Request): Promise<Response> {
  await ensureUser();
  const sent = Date.now();
  const { data, error } = await supabase().functions.invoke('table', { body: req });
  if (error) {
    let message = 'Le serveur de jeu ne répond pas. Réessayez dans un instant.';
    try {
      const body = await (error as { context?: globalThis.Response }).context?.json();
      if (body?.error) message = body.error;
    } catch {
      // réponse sans corps JSON
    }
    throw new OnlineError(message);
  }
  if (typeof data?.serverNow === 'number') clockOffset = data.serverNow - (sent + Date.now()) / 2;
  if (data?.error) throw new OnlineError(data.error);
  return data as Response;
}

const PSEUDO_KEY = 'coach-holdem:pseudo';

export function savedPseudo(): string {
  try {
    return localStorage.getItem(PSEUDO_KEY) ?? '';
  } catch {
    return '';
  }
}

export function savePseudo(name: string) {
  try {
    localStorage.setItem(PSEUDO_KEY, name);
  } catch {
    // stockage indisponible : le pseudo sera redemandé
  }
}
