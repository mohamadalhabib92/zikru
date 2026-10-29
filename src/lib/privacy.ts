/**
 * Confidentialité — logique pure (sans React ni stockage), testée par scripts/test-privacy.mjs.
 *
 * Principes :
 * - minimisation : on n'envoie jamais la position exacte à un tiers, seulement une position
 *   arrondie au dixième de degré (≈ 11 km, l'échelle d'une ville) ;
 * - consentement explicite : tant qu'une case vaut `null` (jamais demandé) ou `false`, rien ne part ;
 * - fail closed : avant le chargement du stockage, la valeur par défaut interdit tout envoi.
 */

/** Pas d'arrondi des coordonnées envoyées aux services météo (0,1° ≈ 11 km). */
export const COARSE_STEP = 0.1;

/** Arrondit une coordonnée au pas donné (0,1° par défaut), sans artefacts flottants. */
export function coarse(x: number, step = COARSE_STEP): number {
  if (!Number.isFinite(x)) return 0;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
  const v = Number((Math.round(x / step) * step).toFixed(decimals));
  return Object.is(v, -0) ? 0 : v;
}

export function coarsePoint(lat: number, lng: number): { lat: number; lng: number } {
  return { lat: coarse(lat), lng: coarse(lng) };
}

export type ConsentKey = 'ai' | 'weather' | 'account';

/** `null` = jamais demandé ; `true` = accepté ; `false` = refusé ou retiré. */
export type Consent = {
  v: number;
  ai: boolean | null;
  weather: boolean | null;
  account: boolean | null;
  at: Partial<Record<ConsentKey, string>>;
};

/** Incrémenter quand le texte d'un consentement change de façon importante : on redemande. */
export const CONSENT_VERSION = 1;

export const DEFAULT_CONSENT: Consent = { v: CONSENT_VERSION, ai: null, weather: null, account: null, at: {} };

/** Normalise une valeur lue du stockage (corrompue, ancienne version…) ; en cas de doute : interdit. */
export function normalizeConsent(raw: unknown): Consent {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONSENT, at: {} };
  const r = raw as Partial<Consent>;
  if (r.v !== CONSENT_VERSION) return { ...DEFAULT_CONSENT, at: {} };
  const b = (x: unknown) => (x === true ? true : x === false ? false : null);
  return { v: CONSENT_VERSION, ai: b(r.ai), weather: b(r.weather), account: b(r.account), at: r.at && typeof r.at === 'object' ? { ...r.at } : {} };
}

/** Seul un « oui » explicite autorise l'envoi. */
export function allows(c: Consent | null | undefined, key: ConsentKey): boolean {
  return !!c && c.v === CONSENT_VERSION && c[key] === true;
}

/** La question n'a encore jamais été posée (afficher l'explication + le choix). */
export function undecided(c: Consent | null | undefined, key: ConsentKey): boolean {
  return !c || c[key] === null;
}

export function decide(c: Consent, key: ConsentKey, on: boolean, now: Date = new Date()): Consent {
  return { ...c, v: CONSENT_VERSION, [key]: on, at: { ...c.at, [key]: now.toISOString() } };
}

/** Prêt à envoyer à l'IA ? (consentement + stockage chargé). */
export function canSendToAI(c: Consent | null | undefined, ready: boolean): boolean {
  return ready && allows(c, 'ai');
}

/** Prêt à interroger la météo ? (consentement + stockage chargé). */
export function canFetchWeather(c: Consent | null | undefined, ready: boolean): boolean {
  return ready && allows(c, 'weather');
}

/** Distance orthodromique en km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nom de la ville connue la plus proche (calcul local, sans géocodage distant), ou null si trop loin. */
export function nearestCityLabel(p: { lat: number; lng: number }, cities: { label: string; lat: number; lng: number }[], maxKm = 25): string | null {
  let best: { label: string; d: number } | null = null;
  for (const c of cities) {
    const d = distanceKm(p, c);
    if (!best || d < best.d) best = { label: c.label, d };
  }
  return best && best.d <= maxKm ? best.label : null;
}

export type PolicyLang = 'fr' | 'en' | 'ar';

/** Langue des textes de confidentialité : arabe, anglais (aussi pour l'allemand), sinon français. */
export function policyLang(lang: string): PolicyLang {
  if (lang === 'ar') return 'ar';
  if (lang === 'en' || lang === 'de' || lang === 'de-CH') return 'en';
  return 'fr';
}
