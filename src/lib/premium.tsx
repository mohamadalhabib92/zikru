/**
 * Droit Premium : cache local, antériorité, revérification du store au lancement.
 * Le web n’achète pas. Les zikrs déjà enregistrés ne sont jamais effacés ici.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLatest } from '@/ui/use-latest';
import { AppState } from 'react-native';
import { createdAnyServerGroup } from './community/api';
import { registerUiStrings } from './l10n';
import { UI_STRINGS_PREMIUM } from './ui-strings-premium';
import { premiumStore } from './premium-store';
import {
  applyStoreCheck,
  canCreatePremiumContent,
  emptyPremiumRecord,
  grantServerGrandfather,
  isUserCreatedLocalGroup,
  observeLocalPremium,
  parsePremiumRecord,
  phaseFromStoreCode,
  type PremiumRecord,
  type PurchasePhase,
  type StoreCheck,
} from './premium-logic';
import { loadJSON, saveJSON } from './storage';
import { useZikrs } from './zikrs';
import { useAuth } from './community/auth';

registerUiStrings(UI_STRINGS_PREMIUM);

const KEY = 'premium-entitlement-v1';

type PremiumCtx = {
  ready: boolean;
  record: PremiumRecord;
  canCreate: boolean;
  price: string | null;
  phase: PurchasePhase;
  payments: boolean;
  buy: () => Promise<void>;
  restore: () => Promise<boolean>;
};

const C = createContext<PremiumCtx | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { zikrs, ready: zikrReady } = useZikrs();
  const auth = useAuth();
  const [record, setRecord] = useState<PremiumRecord>(emptyPremiumRecord);
  const [ready, setReady] = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const [phase, setPhase] = useState<PurchasePhase>('idle');
  const recordRef = useLatest(record);
  const snapped = useRef(false);

  const commit = useCallback(async (next: PremiumRecord) => {
    recordRef.current = next;
    setRecord(next);
    await saveJSON(KEY, next);
  }, [recordRef]);

  const apply = useCallback(
    async (check: StoreCheck) => {
      const next = applyStoreCheck(recordRef.current, check);
      if (next !== recordRef.current) await commit(next);
      if (check.owned === true) setPhase('success');
    },
    [commit, recordRef],
  );

  useEffect(() => {
    return premiumStore.subscribe({
      onCheck: (check) => {
        void apply(check);
      },
      onCode: (code) => setPhase(phaseFromStoreCode(code)),
    });
  }, [apply]);

  useEffect(() => {
    if (!zikrReady || snapped.current) return;
    snapped.current = true;
    let live = true;
    void (async () => {
      const stored = parsePremiumRecord(await loadJSON<unknown>(KEY, null));
      const groups = await loadJSON<{ id: string; createdAt?: number }[]>('community-groups', []);
      const next = observeLocalPremium(stored, {
        now: new Date().toISOString(),
        zikrIds: zikrs.map((z) => z.id),
        localGroupIds: groups.filter(isUserCreatedLocalGroup).map((g) => g.id),
      });
      if (!live) return;
      await commit(next);
      setReady(true);
    })();
    return () => {
      live = false;
    };
    // Le constat local ne se refait pas quand la liste change ensuite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zikrReady]);

  useEffect(() => {
    if (!ready || !auth.session || recordRef.current.grandfather) return;
    let live = true;
    void createdAnyServerGroup().then(async (yes) => {
      if (!live || !yes || recordRef.current.grandfather) return;
      await commit(grantServerGrandfather(recordRef.current, new Date().toISOString()));
    });
    return () => {
      live = false;
    };
  }, [ready, auth.session, commit, recordRef]);

  const reverify = useCallback(async () => {
    if (!premiumStore.payments) return;
    const check = await premiumStore.reverify();
    await apply(check);
  }, [apply]);

  useEffect(() => {
    if (!ready) return;
    void reverify();
    void premiumStore.loadPrice().then(setPrice);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reverify();
    });
    return () => sub.remove();
  }, [ready, reverify]);

  const buy = useCallback(async () => {
    if (!premiumStore.payments) return;
    setPhase('pending');
    try {
      await premiumStore.purchase();
      await reverify();
    } catch {
      /* la phase vient du code store (annulé, hors ligne, échec) */
    }
  }, [reverify]);

  const restore = useCallback(async () => {
    if (!premiumStore.payments) return false;
    setPhase('pending');
    const check = await premiumStore.restore();
    await apply(check);
    if (check.owned == null && !check.online) setPhase('offline');
    else if (check.owned) setPhase('success');
    else setPhase('idle');
    return check.owned === true;
  }, [apply]);

  const value: PremiumCtx = {
    ready,
    record,
    canCreate: canCreatePremiumContent(record, ready),
    price,
    phase,
    payments: premiumStore.payments,
    buy,
    restore,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function usePremium(): PremiumCtx {
  const v = useContext(C);
  if (!v) throw new Error('PremiumProvider manquant');
  return v;
}
