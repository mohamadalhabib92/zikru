import type { SupabaseClient } from '@supabase/supabase-js';
import { backendConfigured, PWA_URL } from './backend';

/**
 * Client Supabase web (PWA), chargé à la demande (passe 6 : supabase-js hors du chargement initial).
 * - `getSupabase()` : promesse du client (null si le serveur n'est pas configuré) — à utiliser partout.
 * - `supabase` : liaison vivante, null tant que le client n'est pas chargé (lecture synchrone seulement
 *   après `await getSupabase()`, ex. dans AuthProvider qui l'attend avant d'être « prêt »).
 * Configuration identique (session localStorage « zikru-auth », PKCE, lien magique détecté dans l'URL).
 */
export const supabaseConfigured = backendConfigured;
export let supabase: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | null = null;
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!backendConfigured) return Promise.resolve(null);
  return (loading ??= import('./supabase-client')
    .then((m) => (supabase = m.makeClient()))
    .catch(() => {
      loading = null; // hors ligne au premier chargement : nouvel essai plus tard
      return null;
    }));
}

/** Retour du lien magique : écran /auth-callback (doit figurer dans « Redirect URLs » de Supabase Auth). */
export const AUTH_REDIRECT = PWA_URL + 'auth-callback';
