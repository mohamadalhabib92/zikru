import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { AUTH_REDIRECT, supabase } from '../supabase';
import { linkErrorMessage, parseAuthReturn } from '../auth-link';
import { deleteMyAccount, getProfile, updateProfile } from './api';

type Profile = { id: string; display_name: string; is_minor: boolean };
type Ctx = {
  enabled: boolean;
  ready: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  /** Nom affiché par défaut (profil, sinon début de l'adresse e-mail). */
  displayName: string;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  setDisplayName: (n: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  linkError: string | null;
  /** Dernière adresse à laquelle un code a été demandé (pour « Renvoyer un lien »). */
  lastEmail: string;
  clearLinkError: () => void;
};
const C = createContext<Ctx | null>(null);

const LAST_EMAIL = 'zikru-last-email';

/** Natif : échange le code PKCE d'un lien magique (zikru://auth-callback?code=…). */
async function handleAuthUrl(url: string | null): Promise<string | null> {
  if (!url || !supabase || !/auth-callback|[?&#]code=|error_description=/.test(url)) return null;
  const r = parseAuthReturn(url);
  if (r.error) return linkErrorMessage(r.errorCode, r.error);
  if (r.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(r.code);
    if (error) return linkErrorMessage(undefined, error.message);
  }
  return null;
}

/** Web : lit une erreur de lien dans l'adresse (?error=… ou #error=…) puis nettoie l'adresse. */
function takeWebLinkError(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const r = parseAuthReturn(window.location.href);
  if (!r.error) return null;
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // sans conséquence
  }
  return linkErrorMessage(r.errorCode, r.error);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [linkError, setLinkError] = useState<string | null>(() => (Platform.OS === 'web' ? takeWebLinkError() : null));
  const [lastEmail, setLastEmail] = useState('');
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => alive && setSession(data.session))
      .catch(() => {})
      .finally(() => alive && setReady(true));
    void AsyncStorage.getItem(LAST_EMAIL).then((v) => alive && v && setLastEmail(v)).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) setLinkError(null);
    });
    let sub: { remove: () => void } | null = null;
    if (Platform.OS !== 'web') {
      void Linking.getInitialURL().then((u) => handleAuthUrl(u).then((e) => e && setLinkError(e)));
      sub = Linking.addEventListener('url', ({ url }) => void handleAuthUrl(url).then((e) => e && setLinkError(e)));
    }
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      sub?.remove();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return setProfile(null);
    try {
      setProfile(await getProfile(userId));
    } catch {
      // hors-ligne : on garde le dernier profil connu
    }
  }, [userId]);
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value: Ctx = {
    enabled: !!supabase,
    ready,
    session,
    userId,
    email: session?.user.email ?? null,
    profile,
    displayName: profile?.display_name || (session?.user.email ?? '').split('@')[0] || 'Moi',
    linkError,
    lastEmail,
    clearLinkError: () => setLinkError(null),
    sendCode: async (email) => {
      if (!supabase) throw new Error('Serveur non configuré.');
      const e = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({ email: e, options: { emailRedirectTo: AUTH_REDIRECT, shouldCreateUser: true } });
      if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Trop de demandes : patientez une minute avant de redemander un code.' : error.message);
      setLastEmail(e);
      void AsyncStorage.setItem(LAST_EMAIL, e).catch(() => {});
    },
    verifyCode: async (email, code) => {
      if (!supabase) throw new Error('Serveur non configuré.');
      const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\s/g, ''), type: 'email' });
      if (error) throw new Error('Code incorrect ou expiré.');
      setLinkError(null);
    },
    setDisplayName: async (n) => {
      if (!userId) return;
      await updateProfile(userId, n.trim().slice(0, 60));
      await refreshProfile();
    },
    refreshProfile,
    signOut: async () => {
      await supabase?.auth.signOut();
      void AsyncStorage.removeItem(LAST_EMAIL).catch(() => {});
      setLastEmail('');
      setProfile(null);
    },
    deleteAccount: async () => {
      await deleteMyAccount();
      await supabase?.auth.signOut();
      void AsyncStorage.removeItem(LAST_EMAIL).catch(() => {});
      setLastEmail('');
      setProfile(null);
    },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useAuth() {
  const v = useContext(C);
  if (!v) throw new Error('AuthProvider manquant');
  return v;
}
