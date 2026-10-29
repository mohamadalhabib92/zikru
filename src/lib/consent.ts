import { useCallback } from 'react';
import { decide, DEFAULT_CONSENT, normalizeConsent, type Consent, type ConsentKey } from './privacy';
import { shared, useShared } from './shared-state';

/** Consentements de confidentialité (stockés sur l'appareil uniquement). */
export const consentStore = shared<Consent>('privacy-consent', DEFAULT_CONSENT, (stored) => normalizeConsent(stored));

/** [consentements, décider(clé, oui/non), prêt]. Avant chargement : tout est refusé (fail closed). */
export function useConsent(): [Consent, (key: ConsentKey, on: boolean) => void, boolean] {
  const [c, set, ready] = useShared(consentStore);
  const choose = useCallback((key: ConsentKey, on: boolean) => set((prev) => decide(normalizeConsent(prev), key, on)), [set]);
  return [ready ? c : DEFAULT_CONSENT, choose, ready];
}
