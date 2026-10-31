import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { backendConfigured, PWA_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from './backend';

/** Client Supabase web (PWA) : session dans localStorage, lien magique détecté dans l'URL (PKCE). */
const isBrowser = typeof window !== 'undefined';
export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(SUPABASE_URL.value!, SUPABASE_ANON_KEY.value!, {
      auth: {
        storage: isBrowser ? window.localStorage : undefined,
        storageKey: 'zikru-auth',
        autoRefreshToken: isBrowser,
        persistSession: isBrowser,
        detectSessionInUrl: isBrowser,
        flowType: 'pkce',
      },
    })
  : null;

/** Retour du lien magique : écran /auth-callback (doit figurer dans « Redirect URLs » de Supabase Auth). */
export const AUTH_REDIRECT = PWA_URL + 'auth-callback';
