import { useEffect, useState } from 'react';
import { myEntitlements } from './community/api';
import { useAuth } from './community/auth';
import { featureEnabled, limitsOf, PREMIUM_KEYS } from './premium';
import { loadJSON, saveJSON } from './storage';

/**
 * Lit get_my_entitlements() et en garde une copie par compte.
 * Hors-ligne : dernière copie. Rien de connu : les fonctions Premium restent fermées.
 * N’écrit aucun droit : le serveur est seul juge.
 */
export function usePremium() {
  const { userId } = useAuth();
  const [limits, setLimits] = useState<Record<string, unknown> | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) {
        if (alive) {
          setLimits(null);
          setReady(true);
        }
        return;
      }
      const cached = limitsOf(await loadJSON<unknown>(`entitlements-${userId}`, null));
      if (alive && cached) setLimits(cached);
      try {
        const raw = await myEntitlements();
        if (!alive) return;
        setLimits(limitsOf(raw));
        await saveJSON(`entitlements-${userId}`, raw);
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
  return {
    ready,
    themes: featureEnabled(limits, PREMIUM_KEYS.themes),
    tijaniGuide: featureEnabled(limits, PREMIUM_KEYS.tijaniGuide),
  };
}
