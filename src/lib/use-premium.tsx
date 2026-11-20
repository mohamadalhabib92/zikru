import { useEffect, useState } from 'react';
import { myEntitlements } from './community/api';
import { useAuth } from './community/auth';
import { featureEnabled, limitsOf, PREMIUM_KEYS, serverGrantsPremium } from './premium-flags';
import { loadJSON, saveJSON } from './storage';

/**
 * Lit get_my_entitlements() et en garde une copie par compte.
 * Hors-ligne : dernière copie. Rien de connu : les fonctions Premium restent fermées.
 * N’écrit aucun droit : le serveur est seul juge.
 */
export function useFeatureFlags() {
  const { userId } = useAuth();
  const [raw, setRaw] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) {
        if (alive) {
          setRaw(null);
          setReady(true);
        }
        return;
      }
      const cached = await loadJSON<unknown>(`entitlements-${userId}`, null);
      if (alive && limitsOf(cached)) setRaw(cached);
      try {
        const next = await myEntitlements();
        if (!alive) return;
        setRaw(next);
        await saveJSON(`entitlements-${userId}`, next);
      } catch {
        // cache déjà appliqué, sinon verrouillé
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);
  const limits = limitsOf(raw);
  return {
    ready,
    themes: featureEnabled(limits, PREMIUM_KEYS.themes),
    tijaniGuide: featureEnabled(limits, PREMIUM_KEYS.tijaniGuide),
    serverPremium: serverGrantsPremium(raw),
  };
}
