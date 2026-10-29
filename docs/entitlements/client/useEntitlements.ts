/**
 * Zikru P1a — hook des droits. BROUILLON, non branché. Emplacement prévu : src/lib/entitlements/useEntitlements.ts.
 * Lit get_my_entitlements() au montage, au retour au premier plan et quand le cache a plus de 6 h.
 * Hors-ligne : dernier état connu (AsyncStorage, une clé par compte). Rien de connu : défaut sûr (voir entitlements.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabase';
import { cacheKey, capOf, featureOn, fromCache, isStale, parseEntitlements, toCache, type Cap, type Entitlements } from './entitlements';

export async function fetchEntitlements(userId: string): Promise<Entitlements | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_my_entitlements');
  if (error) throw new Error(error.message);
  const e = parseEntitlements(data, Date.now());
  if (e) await AsyncStorage.setItem(cacheKey(userId), toCache(e));
  return e;
}

/** À appeler à la déconnexion (avec flushAndResetOnSignOut du compteur). */
export const clearEntitlements = (userId: string) => AsyncStorage.removeItem(cacheKey(userId));

export function useEntitlements(userId: string | null) {
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entRef = useRef<Entitlements | null>(null);
  entRef.current = ent;

  const refresh = useCallback(async (force = false) => {
    if (!userId) return;
    if (!force && !isStale(entRef.current, Date.now())) return;
    try {
      const e = await fetchEntitlements(userId);
      if (e) setEnt(e);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); // on garde le cache
    }
  }, [userId]);

  useEffect(() => {
    let alive = true;
    setEnt(null);
    setReady(false);
    if (!userId) return;
    void (async () => {
      const cached = fromCache(await AsyncStorage.getItem(cacheKey(userId)));
      if (!alive) return;
      if (cached) setEnt(cached);
      setReady(true);
      entRef.current = cached;
      await refresh(true);
    })();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refresh(); });
    return () => { alive = false; sub.remove(); };
  }, [userId, refresh]);

  return {
    ready,
    error,
    plan: ent?.plan ?? null,
    entitlements: ent,
    stale: isStale(ent, Date.now()),
    /** Ex. cap('max_group_members_created') : { kind: 'limited', value: … } | 'unlimited' | 'unknown'. */
    cap: (key: string): Cap => capOf(ent, key),
    feature: (key: string) => featureOn(ent, key),
    refresh: () => refresh(true),
  };
}
