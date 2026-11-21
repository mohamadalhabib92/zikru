/**
 * Apple TV : les mêmes fonctions gratuites que l’iPhone, et le compteur familial.
 * Le produit Premium est le même achat unique que sur iPhone. StoreKit n’est pas appelé ici.
 */
import { LANDSCAPE_THEMES_REQUIRE_PREMIUM } from './landscapes';
import { PREMIUM_PRODUCT_ID, isPremiumActive, type PremiumRecord } from './premium-logic';
import { serverGrantsPremium } from './premium-flags';

export const TV_BUNDLE_ID = 'com.vibecode.zikru-76mpdv';
/**
 * Même achat que l’iPhone. La source est `PREMIUM_PRODUCT_ID` (PR 10) :
 * `ch.mohamadba.zikru.premium.lifetime`. Le bundle `com.vibecode.zikru-76mpdv`
 * contient un trait d’union, qu’App Store Connect refuse dans un identifiant
 * d’achat, donc ce n’est pas le product id.
 */
export const TV_PRODUCT_ID = PREMIUM_PRODUCT_ID;

/** Taille minimale de l’arabe à dix pieds (lisibilité salon). */
export const TV_ARABIC_MIN = 36;

/**
 * Même découpage que l’iPhone.
 * Gratuit : accueil, Coran, horaires, adhan, compteur (dhikr, enfants, montre),
 * wirds déjà livrés, discussion, rejoindre un groupe.
 * Le paysage du salon suit le drapeau iPhone (`LANDSCAPE_THEMES_REQUIRE_PREMIUM`, aujourd’hui gratuit).
 * Premium, et seulement au moment où on ouvre cette fonction : thèmes Verre et récitation guidée des wirds.
 * Créer un zikr ou un groupe n’a pas d’écran sur le téléviseur.
 */
export const TV_FEATURES = {
  home: { premium: false },
  join: { premium: false },
  chat: { premium: false },
  quran: { premium: false },
  prayers: { premium: false },
  adhan: { premium: false },
  dhikr: { premium: false },
  kids: { premium: false },
  ambient: { premium: LANDSCAPE_THEMES_REQUIRE_PREMIUM },
  themes: { premium: true },
  tijaniGuide: { premium: true },
} as const;

export type TvFeatureId = keyof typeof TV_FEATURES;

/**
 * Une fonction gratuite n’est jamais verrouillée, même si le module d’achat manque
 * ou répond « pas Premium ». Une fonction Premium s’ouvre avec un droit déjà connu
 * (cache StoreKit, antériorité, ou droit Supabase).
 */
export function tvFeatureAllowed(id: TvFeatureId, premiumActive: boolean, _purchasesAvailable = true): boolean {
  if (!TV_FEATURES[id].premium) return true;
  return premiumActive;
}

/** Le mur d’achat ne s’affiche qu’en ouvrant une fonction qui est Premium sur iPhone, et seulement si le droit manque. */
export function tvPaywallVisible(id: TvFeatureId, premiumActive: boolean, purchasesAvailable = true): boolean {
  return !tvFeatureAllowed(id, premiumActive, purchasesAvailable);
}

export function tvPremiumActive(record: PremiumRecord | null, serverEntitlement?: unknown): boolean {
  return isPremiumActive(record) || serverGrantsPremium(serverEntitlement);
}

/**
 * Compteur du salon : la session familiale seulement quand elle est en direct
 * et qu’un compte est déjà là. Sinon le compteur local, sans demande de connexion.
 */
export function tvCountIsLocal(live: boolean, signedIn: boolean): boolean {
  return !(live && signedIn);
}

/** Corps du verset : plus le texte est court, plus le glyphe est grand, jamais sous le plancher. */
export function tvAyahType(text: string): { fontSize: number; lineHeight: number } {
  const n = [...(text ?? '')].length;
  const fontSize = n <= 40 ? 72 : n <= 90 ? 56 : n <= 180 ? 44 : TV_ARABIC_MIN;
  return { fontSize: Math.max(TV_ARABIC_MIN, fontSize), lineHeight: Math.round(Math.max(TV_ARABIC_MIN, fontSize) * 1.9) };
}

export type TvCountRow = { userId: string; name: string; count: number };

export function rowsFromSession(rows: { user_id?: string; display_name?: string; count?: number }[] | null | undefined): TvCountRow[] {
  const out: TvCountRow[] = [];
  for (const row of rows ?? []) {
    if (!row?.user_id || !Number.isFinite(row.count)) continue;
    out.push({ userId: row.user_id, name: (row.display_name || '').trim() || 'Membre', count: Math.max(0, Math.round(row.count as number)) });
  }
  return mergeCounts([], out);
}

/** Dernière valeur par personne, triée par compte décroissant. */
export function mergeCounts(base: TvCountRow[], incoming: TvCountRow[]): TvCountRow[] {
  const map = new Map<string, TvCountRow>();
  for (const row of base) if (row.userId) map.set(row.userId, row);
  for (const row of incoming) if (row.userId && Number.isFinite(row.count)) map.set(row.userId, { ...row, count: Math.max(0, Math.round(row.count)) });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Total affiché : les autres viennent du serveur, le mien peut être en avance (appui pas encore envoyé). */
export function sessionTotal(rows: TvCountRow[], mine: { userId: string; count: number } | null): number {
  const others = rows.filter((r) => !mine || r.userId !== mine.userId).reduce((sum, r) => sum + r.count, 0);
  return others + (mine?.count ?? 0);
}

export function goalTotal(progress: { total?: number }[] | null | undefined): number {
  return (progress ?? []).reduce((sum, row) => sum + (Number.isFinite(row?.total) ? Math.max(0, row.total as number) : 0), 0);
}

/** Mode enfant : son propre compte, sans le détail des autres. */
export function kidsCount(rows: TvCountRow[], userId: string | null): number {
  if (!userId) return 0;
  return rows.find((r) => r.userId === userId)?.count ?? 0;
}
