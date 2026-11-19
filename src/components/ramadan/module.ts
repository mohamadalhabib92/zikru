/**
 * Point d’entrée unique du module Ramadan, importé uniquement par import() dynamique
 * (route src/app/ramadan.tsx et écran de validation) : écrans, carte et traductions restent hors du chargement initial.
 * (Le calcul des dates et le magasin `ramadan` sont, eux, dans le paquet initial : rappels, bandeau d’accueil et widgets en ont besoin.)
 */
import { registerUiStrings } from '@/lib/l10n';
import { UI_STRINGS_RAMADAN } from '@/lib/ui-strings-ramadan';

registerUiStrings(UI_STRINGS_RAMADAN);

export { default as Hub } from './screens/hub';
export { default as Compte } from './screens/compte';
export { default as Jeune } from './screens/jeune';
export { default as Tarawih } from './screens/tarawih';
export { default as Nuits } from './screens/nuits';
export { default as Zakat } from './screens/zakat';
export { default as Carte } from './screens/carte';
export { ramadanRows } from '@/lib/review-ramadan';
