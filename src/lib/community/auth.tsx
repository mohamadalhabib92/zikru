import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { AUTH_REDIRECT, getSupabase, supabaseConfigured } from '../supabase';
import { linkErrorMessage, parseAuthReturn } from '../auth-link';
import { deleteMyAccount, getProfile, updateProfile } from './api';
import { disableGroupPush, refreshGroupPush } from '../group-push';

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
  if (!url || !/auth-callback|[?&#]code=|error_description=/.test(url)) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;
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

/**
 * Web : faut-il charger le client Supabase dès le démarrage ? Seulement si une session existe déjà sur
 * l'appareil ou si l'adresse est un retour de lien de connexion. Sinon (cas le plus courant : pas de compte),
 * supabase-js n'est chargé qu'à la première action en ligne (envoi du code, invitation…).
 */
function clientNeededAtStart(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  try {
    if (window.localStorage?.getItem('zikru-auth')) return true;
  } catch {
    return true;
  }
  return /auth-callback|[?&#]code=|error_description=/.test(window.location?.href ?? '');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);
  const [linkError, setLinkError] = useState<string | null>(() => (Platform.OS === 'web' ? takeWebLinkError() : null));
  const [lastEmail, setLastEmail] = useState('');
  const userId = session?.user.id ?? null;
  // Client chargé à la demande : on s'abonne aux changements de session dès qu'il est disponible (une seule fois).
  const attached = useRef<SupabaseClient | null>(null);
  const unsub = useRef<(() => void) | null>(null);
  const client = useCallback(async (): Promise<SupabaseClient | null> => {
    const c = await getSupabase();
    if (c && attached.current !== c) {
      attached.current = c;
      const { data } = c.auth.onAuthStateChange((_e, s) => {
        setSession(s);
        if (s) setLinkError(null);
      });
      unsub.current = () => data.subscription.unsubscribe();
    }
    return c;
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    void AsyncStorage.getItem(LAST_EMAIL).then((v) => alive && v && setLastEmail(v)).catch(() => {});
    if (clientNeededAtStart()) {
      void client()
        .then((c) => c?.auth.getSession())
        .then((r) => alive && r && setSession(r.data.session))
        .catch(() => {})
        .finally(() => alive && setReady(true));
    } else {
      // Aucune session sur cet appareil : prêt tout de suite, sans télécharger supabase-js.
      Promise.resolve().then(() => alive && setReady(true));
    }
    let sub: { remove: () => void } | null = null;
    if (Platform.OS !== 'web') {
      void Linking.getInitialURL().then((u) => handleAuthUrl(u).then((e) => e && setLinkError(e)));
      sub = Linking.addEventListener('url', ({ url }) => void handleAuthUrl(url).then((e) => e && setLinkError(e)));
    }
    return () => {
      alive = false;
      unsub.current?.();
      attached.current = null;
      sub?.remove();
    };
  }, [client]);

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
  // Passe 6 : notifications de groupe (natif, derrière EXPO_PUBLIC_GROUP_PUSH ; sans effet ailleurs).
  useEffect(() => {
    if (userId) void refreshGroupPush();
  }, [userId]);

  const value: Ctx = {
    enabled: supabaseConfigured,
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
      const supabase = await client();
      if (!supabase) throw new Error('Serveur non configuré.');
      const e = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({ email: e, options: { emailRedirectTo: AUTH_REDIRECT, shouldCreateUser: true } });
      if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Trop de demandes : patientez une minute avant de redemander un code.' : error.message);
      setLastEmail(e);
      void AsyncStorage.setItem(LAST_EMAIL, e).catch(() => {});
    },
    verifyCode: async (email, code) => {
      const supabase = await client();
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
      await disableGroupPush(); // le jeton de l'appareil est retiré AVANT la déconnexion (sinon l'ancien compte reste notifié)
      await (await client())?.auth.signOut();
      void AsyncStorage.removeItem(LAST_EMAIL).catch(() => {});
      setLastEmail('');
      setProfile(null);
    },
    deleteAccount: async () => {
      await deleteMyAccount(); // les jetons push du compte sont supprimés en cascade côté serveur
      await disableGroupPush();
      await (await client())?.auth.signOut();
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
