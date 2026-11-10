/**
 * Zikru Premium — logique pure (aucun StoreKit, aucun réseau).
 * Achat unique à vie. Le prix n’est jamais écrit ici : il vient du store.
 *
 * Antériorité : au premier passage de cette version, les zikrs et groupes
 * déjà créés débloquent Premium à vie sur l’appareil. On n’efface ni ne
 * réécrit ces données. On ajoute seulement un enregistrement local.
 * Les zikrs déjà présents restent modifiables même sans cet enregistrement.
 */

/** Identifiant App Store et Play. Lettres, chiffres, underscores et points seulement : App Store Connect refuse le trait d’union. Le bundle iOS reste com.vibecode.zikru-76mpdv. */
export const PREMIUM_PRODUCT_ID = 'ch.mohamadba.zikru.premium.lifetime';

/** Groupe local livré avec l’app. Il ne compte pas comme une création de l’utilisateur. */
export const SEEDED_LOCAL_GROUP_ID = 'g-allahu-akbar';

export type StorePlatform = 'ios' | 'android';

export type PremiumStore = {
  productId: typeof PREMIUM_PRODUCT_ID;
  transactionId: string;
  platform: StorePlatform;
  verifiedAt: number;
};

export type PremiumRecord = {
  v: 1;
  /** Horodatage du premier constat local. Une fois posé, on ne recompte pas les créations suivantes. */
  decidedAt: string | null;
  /** L’utilisateur avait déjà créé un zikr ou un groupe avant ce constat (ou un groupe serveur plus tard). */
  grandfather: boolean;
  zikrIds: string[];
  localGroupIds: string[];
  store: PremiumStore | null;
};

export type StoreCheck = {
  online: boolean;
  /** true = détenu, false = le store a répondu et le produit n’y est pas, null = inconnu (hors ligne, attente, erreur). */
  owned: boolean | null;
  transactionId?: string | null;
  platform: StorePlatform;
  now: number;
};

export type PurchasePhase = 'idle' | 'pending' | 'cancelled' | 'failed' | 'offline' | 'success';

export type StoreListener = {
  onCheck: (check: StoreCheck) => void;
  onCode: (code: string | null) => void;
};

export function emptyPremiumRecord(): PremiumRecord {
  return { v: 1, decidedAt: null, grandfather: false, zikrIds: [], localGroupIds: [], store: null };
}

const idsOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80) : [];

/** Cache illisible → enregistrement vide (pas de droit inventé). */
export function parsePremiumRecord(raw: unknown): PremiumRecord {
  if (!raw || typeof raw !== 'object') return emptyPremiumRecord();
  const r = raw as Record<string, unknown>;
  let store: PremiumStore | null = null;
  if (r.store && typeof r.store === 'object') {
    const s = r.store as Record<string, unknown>;
    if (
      s.productId === PREMIUM_PRODUCT_ID &&
      typeof s.transactionId === 'string' &&
      s.transactionId.length > 0 &&
      (s.platform === 'ios' || s.platform === 'android')
    ) {
      store = {
        productId: PREMIUM_PRODUCT_ID,
        transactionId: s.transactionId,
        platform: s.platform,
        verifiedAt: typeof s.verifiedAt === 'number' && Number.isFinite(s.verifiedAt) ? s.verifiedAt : 0,
      };
    }
  }
  return {
    v: 1,
    decidedAt: typeof r.decidedAt === 'string' && r.decidedAt ? r.decidedAt : null,
    grandfather: r.grandfather === true,
    zikrIds: idsOf(r.zikrIds),
    localGroupIds: idsOf(r.localGroupIds),
    store,
  };
}

export function isUserCreatedLocalGroup(g: { id: string; createdAt?: number }): boolean {
  if (g.id === SEEDED_LOCAL_GROUP_ID && !(typeof g.createdAt === 'number' && g.createdAt > 0)) return false;
  return g.id !== SEEDED_LOCAL_GROUP_ID || (typeof g.createdAt === 'number' && g.createdAt > 0);
}

export function hasStorePremium(r: PremiumRecord | null): boolean {
  return !!r?.store && r.store.productId === PREMIUM_PRODUCT_ID && r.store.transactionId.length > 0;
}

export function isPremiumActive(r: PremiumRecord | null): boolean {
  return !!r && (r.grandfather || hasStorePremium(r));
}

/** Créer un zikr ou un groupe. Tant que le constat n’est pas fait, on refuse (on ne grand-père pas une création de cette session). */
export function canCreatePremiumContent(r: PremiumRecord | null, ready: boolean): boolean {
  return ready && isPremiumActive(r);
}

/**
 * Un zikr déjà dans la liste reste modifiable. Le verrou ne porte que sur la création.
 * On ne retire jamais une composition existante.
 */
export function canEditExistingZikr(existingIds: readonly string[], id: string): boolean {
  return existingIds.includes(id);
}

/**
 * Premier constat local. S’il est déjà fait, on ne relit pas la liste :
 * un zikr créé après ne devient pas une antériorité.
 */
export function observeLocalPremium(
  prev: PremiumRecord,
  obs: { now: string; zikrIds: string[]; localGroupIds: string[] },
): PremiumRecord {
  if (prev.decidedAt) return prev;
  const zikrIds = idsOf(obs.zikrIds);
  const localGroupIds = idsOf(obs.localGroupIds);
  const grant = zikrIds.length > 0 || localGroupIds.length > 0;
  return {
    ...prev,
    decidedAt: obs.now,
    grandfather: prev.grandfather || grant,
    zikrIds,
    localGroupIds,
  };
}

/** Un groupe déjà créé sur le serveur (famille, cercle ou programme) débloque aussi, sans retirer le constat local. */
export function grantServerGrandfather(prev: PremiumRecord, now: string): PremiumRecord {
  if (prev.grandfather) return prev;
  return { ...prev, grandfather: true, decidedAt: prev.decidedAt ?? now };
}

/**
 * Revérification au lancement.
 * Hors ligne ou inconnu : on garde le droit en cache.
 * Store en ligne sans le produit : on retire seulement l’achat (remboursement), jamais l’antériorité.
 */
export function applyStoreCheck(prev: PremiumRecord, check: StoreCheck): PremiumRecord {
  if (check.owned === true && check.transactionId) {
    return {
      ...prev,
      store: {
        productId: PREMIUM_PRODUCT_ID,
        transactionId: check.transactionId,
        platform: check.platform,
        verifiedAt: check.now,
      },
    };
  }
  if (check.owned === false && check.online) return { ...prev, store: null };
  return prev;
}

export function phaseFromStoreCode(code: string | null | undefined): Exclude<PurchasePhase, 'idle' | 'success'> {
  switch (code) {
    case 'user-cancelled':
      return 'cancelled';
    case 'deferred-payment':
    case 'pending':
    case 'already-owned':
      return 'pending';
    case 'network-error':
    case 'remote-error':
    case 'service-unavailable':
    case 'service-disconnected':
    case 'service-timeout':
    case 'billing-unavailable':
    case 'connection-closed':
    case 'init-connection':
    case 'not-prepared':
    case 'iap-not-available':
      return 'offline';
    default:
      return 'failed';
  }
}
