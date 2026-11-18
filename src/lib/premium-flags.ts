/**
 * Droits Premium côté client — même règle que `featureOn` dans
 * docs/entitlements/client/entitlements.ts : une fonction n’est ouverte
 * que si la limite renvoyée par le serveur vaut exactement `true`.
 * Inconnue, absente ou fausse → fermée. On ne promet rien qu’on ne peut pas tenir.
 *
 * Déjà gratuit, et qui le reste (architecture §7, et la règle de ce chantier) :
 * le compteur de dhikr, le compteur de la montre (le même compteur), la messagerie, les groupes.
 * Le texte des wirds déjà livré (lecture et cases à cocher) reste lisible.
 * Nouveau et Premium : thèmes translucides (`themes`, clé déjà en base) et
 * récitation guidée des wirds tijani (`tijani_guide`).
 */

export const PREMIUM_KEYS = {
  themes: 'themes',
  tijaniGuide: 'tijani_guide',
} as const;

/** Toujours hors Premium. Sert de garde-fou pour les tests : ces clés ne sont pas des verrous. */
export const ALWAYS_FREE = ['counter', 'watch_counter', 'chat', 'groups'] as const;

export function limitsOf(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const limits = (raw as { limits?: unknown }).limits;
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return null;
  return limits as Record<string, unknown>;
}

/** Vrai seulement si le serveur a renvoyé le booléen true. */
export function featureEnabled(limits: Record<string, unknown> | null | undefined, key: string): boolean {
  return !!limits && limits[key] === true;
}

export function glassThemeAllowed(limits: Record<string, unknown> | null | undefined): boolean {
  return featureEnabled(limits, PREMIUM_KEYS.themes);
}

export function tijaniGuideAllowed(limits: Record<string, unknown> | null | undefined): boolean {
  return featureEnabled(limits, PREMIUM_KEYS.tijaniGuide);
}
