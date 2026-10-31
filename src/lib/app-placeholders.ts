import { isMethodKey, type MethodKey } from './prayer';

/**
 * Décisions éditoriales que seul le porteur du projet peut fournir (brief §15).
 * Tant qu'une valeur commence par « YOUR_ », elle est « à compléter » : l'app garde un comportement sûr
 * et n'affiche jamais de valeur inventée.
 */
export const PLACEHOLDERS = {
  /** Clé de METHODS (ex. MuslimWorldLeague, UOIF, Turkey…). */
  DEFAULT_PRAYER_METHOD: 'YOUR_DEFAULT_PRAYER_METHOD',
  QURAN_TRANSLATIONS_LICENSES: 'YOUR_QURAN_TRANSLATIONS_LICENSES',
  SCHOLAR_VALIDATOR_NAME: 'YOUR_SCHOLAR_VALIDATOR_NAME',
  SUPPORT_EMAIL: 'YOUR_SUPPORT_EMAIL',
} as const;

export const isPlaceholder = (v: string | null | undefined) => !v || v.trim().startsWith('YOUR_');

/** Méthode utilisée tant qu'aucune n'est fournie : celle d'avant la Passe 1 (aucun changement d'horaire). */
export const FALLBACK_PRAYER_METHOD: MethodKey = 'MuslimWorldLeague';

export function resolveDefaultMethod(v: string = PLACEHOLDERS.DEFAULT_PRAYER_METHOD): MethodKey {
  return !isPlaceholder(v) && isMethodKey(v) ? v : FALLBACK_PRAYER_METHOD;
}
