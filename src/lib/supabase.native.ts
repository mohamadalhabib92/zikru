import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { backendConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from './backend';

/** Client Supabase natif : session dans AsyncStorage, liens magiques via zikru://auth-callback (PKCE). */
export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(SUPABASE_URL.value!, SUPABASE_ANON_KEY.value!, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
    })
  : null;

// Rafraîchissement du jeton uniquement au premier plan (recommandation Supabase pour React Native).
if (supabase) {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const AUTH_REDIRECT = 'zikru://auth-callback';
