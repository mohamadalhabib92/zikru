import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './backend';

/**
 * Client Supabase web (PWA) : session dans localStorage, lien magique détecté dans l'URL (PKCE).
 * Passe 6 : module chargé à la demande (src/lib/supabase.ts → getSupabase) pour sortir supabase-js
 * (≈ 230 Ko) du chargement initial. Même configuration qu'avant.
 */
export function makeClient(): SupabaseClient {
  const isBrowser = typeof window !== 'undefined';
  return createClient(SUPABASE_URL.value!, SUPABASE_ANON_KEY.value!, {
    auth: {
      storage: isBrowser ? window.localStorage : undefined,
      storageKey: 'zikru-auth',
      autoRefreshToken: isBrowser,
      persistSession: isBrowser,
      detectSessionInUrl: isBrowser,
      flowType: 'pkce',
    },
  });
}
