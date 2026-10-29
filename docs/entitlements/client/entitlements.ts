/**
 * Zikru P1a — droits gratuit/premium côté client : logique PURE (testée avec jest).
 * BROUILLON, non branché. Emplacement prévu : src/lib/entitlements/entitlements.ts.
 *
 * Règles :
 *  - Le serveur est seul juge (déclencheur circle_members_guard, RPC). Le client n'affiche qu'une indication.
 *  - Aucune limite n'est codée en dur : on lit get_my_entitlements(), on met en cache pour le hors-ligne.
 *  - Défaut sûr quand on ne sait rien (premier lancement hors-ligne) : limite « inconnue ».
 *      · limites numériques inconnues → on NE bloque PAS l'action ; le serveur tranchera (erreur ZKG01) ;
 *      · fonctions premium inconnues → désactivées (on ne promet rien qu'on ne peut pas tenir).
 */

/** Valeur d'une limite telle que renvoyée par le serveur. null = illimité. */
export type LimitValue = number | boolean | null;

export type Entitlements = {
  plan: string;
  source: 'manual' | 'storekit' | 'play' | 'promo' | null;
  validUntil: string | null;
  paymentsEnabled: boolean;
  limits: Record<string, LimitValue>;
  configVersion: number | null;
  /** Horodatage local (ms) de la dernière lecture serveur réussie. */
  fetchedAt: number;
};

export type Cap = { kind: 'unknown' } | { kind: 'unlimited' } | { kind: 'limited'; value: number };

/** Clés connues (le serveur peut en ajouter : elles passent telles quelles dans `limits`). */
export const LIMIT_KEYS = {
  groupMembers: 'max_group_members_created',
  groupsCreated: 'max_groups_created',
  bilalDaily: 'bilal_daily_quota',
} as const;

/** Durée au-delà de laquelle on relit le serveur (le cache reste utilisable hors-ligne). */
export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

/** Une entrée de cache par compte : pas de fuite de droits d'un compte à l'autre sur le même appareil. */
export const cacheKey = (userId: string) => `zikru-entitlements-v1:${userId}`;

const SOURCES = new Set(['manual', 'storekit', 'play', 'promo']);

/** Valide la réponse de get_my_entitlements() (ou un cache) ; null si inexploitable. */
export function parseEntitlements(raw: unknown, fetchedAt: number): Entitlements | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.plan !== 'string' || !r.limits || typeof r.limits !== 'object' || Array.isArray(r.limits)) return null;
  const limits: Record<string, LimitValue> = {};
  for (const [k, v] of Object.entries(r.limits as Record<string, unknown>)) {
    if (v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) limits[k] = v as LimitValue;
  }
  return {
    plan: r.plan,
    source: typeof r.source === 'string' && SOURCES.has(r.source) ? (r.source as Entitlements['source']) : null,
    validUntil: typeof r.valid_until === 'string' ? r.valid_until : null,
    paymentsEnabled: r.payments_enabled === true,
    limits,
    configVersion: typeof r.config_version === 'number' ? r.config_version : null,
    fetchedAt,
  };
}

/** Sérialisation du cache (format serveur, pour relire avec parseEntitlements). */
export function toCache(e: Entitlements): string {
  return JSON.stringify({
    plan: e.plan, source: e.source, valid_until: e.validUntil, payments_enabled: e.paymentsEnabled,
    limits: e.limits, config_version: e.configVersion, fetched_at: e.fetchedAt,
  });
}
export function fromCache(json: string | null): Entitlements | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    return parseEntitlements(raw, typeof raw.fetched_at === 'number' ? raw.fetched_at : 0);
  } catch {
    return null;
  }
}

export function isStale(e: Entitlements | null, now: number, ttlMs = DEFAULT_TTL_MS): boolean {
  return !e || now - e.fetchedAt >= ttlMs || now < e.fetchedAt;
}

/** Limite numérique. Clé absente, type inattendu ou aucun droit connu → 'unknown'. */
export function capOf(e: Entitlements | null, key: string): Cap {
  if (!e || !(key in e.limits)) return { kind: 'unknown' };
  const v = e.limits[key];
  if (v === null) return { kind: 'unlimited' };
  if (typeof v === 'number') return { kind: 'limited', value: v };
  return { kind: 'unknown' };
}

/** Fonction premium (thèmes, statistiques détaillées…). Inconnu → false. */
export function featureOn(e: Entitlements | null, key: string): boolean {
  return !!e && e.limits[key] === true;
}

/** Indication d'interface : peut-on encore ajouter quelqu'un ? 'unknown' → laisser essayer. */
export function roomLeft(cap: Cap, current: number): number | 'unlimited' | 'unknown' {
  if (cap.kind === 'limited') return Math.max(0, cap.value - current);
  return cap.kind;
}

/** Erreurs de limite renvoyées par le serveur (SQLSTATE stable, jamais le texte). */
export type LimitError =
  | { reason: 'group_full'; limit: number | null; members: number | null }
  | { reason: 'groups_created_limit'; limit: number | null }
  | { reason: 'bilal_quota' };

export function limitErrorFrom(err: { code?: string; details?: string | null; status?: number; error?: string } | null | undefined): LimitError | null {
  if (!err) return null;
  let d: Record<string, unknown> = {};
  try {
    d = err.details ? (JSON.parse(err.details) as Record<string, unknown>) : {};
  } catch {
    d = {};
  }
  const num = (v: unknown) => (typeof v === 'number' ? v : null);
  if (err.code === 'ZKG01') return { reason: 'group_full', limit: num(d.limit), members: num(d.members) };
  if (err.code === 'ZKG02') return { reason: 'groups_created_limit', limit: num(d.limit) };
  if (err.status === 429 && err.error === 'quota') return { reason: 'bilal_quota' };
  return null;
}

/** Texte français pour l'utilisateur. Le chiffre vient du serveur ; sans chiffre, phrase neutre. */
export function limitMessage(e: LimitError): string {
  switch (e.reason) {
    case 'group_full':
      return e.limit != null
        ? `Ce groupe est complet (${e.limit} membres maximum, créateur inclus).`
        : 'Ce groupe est complet.';
    case 'groups_created_limit':
      return e.limit != null ? `Vous avez atteint la limite de ${e.limit} groupes créés.` : 'Limite de groupes créés atteinte.';
    case 'bilal_quota':
      return 'Le quota quotidien d’El Ghaly Bilal est atteint. Il se renouvelle demain (minuit UTC).';
  }
}
