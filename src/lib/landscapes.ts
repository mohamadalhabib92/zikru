/**
 * Fonds de paysage du compteur (tasbih).
 *
 * Prix : un seul drapeau, ici. `false` = gratuits (défaut, en attendant Mohamed).
 * `true` = choisir un paysage exige le droit Premium déjà utilisé ailleurs (`canCreate`).
 * « Aucun » reste toujours disponible. Un paysage déjà enregistré continue de s’afficher :
 * le réglage n’est pas effacé.
 */
export const LANDSCAPE_THEMES_REQUIRE_PREMIUM = false;

export const LANDSCAPE_IDS = ['lagoon', 'dunes', 'mist', 'stars', 'oasis', 'sunset', 'garden', 'peaks', 'cream', 'emerald'] as const;
export type LandscapeId = (typeof LANDSCAPE_IDS)[number];
export type LandscapeChoice = LandscapeId | 'none';

/**
 * Plaque derrière le texte (arabe, traduction, boutons, puces).
 * 1 = opaque, couleur `theme.bg` : le rapport de contraste est celui des jetons déjà mesurés,
 * et les harakât restent nets (aucun flou sous les glyphes).
 */
export const LANDSCAPE_PLATE_ALPHA = 1;

/**
 * Voile sur le fond quand le paysage est choisi pour toute l’application.
 * Assez opaque pour que le texte (y compris l’arabe) garde le contraste des jetons,
 * assez clair pour que le paysage reste visible.
 */
export const APP_LANDSCAPE_SCRIM = 0.94;

export function sanitizeLandscape(v: unknown): LandscapeChoice {
  return (LANDSCAPE_IDS as readonly string[]).includes(v as string) ? (v as LandscapeId) : 'none';
}
