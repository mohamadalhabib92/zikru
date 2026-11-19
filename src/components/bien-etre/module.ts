/**
 * Point d’entrée unique du module bien-être, importé uniquement par import() dynamique
 * (routes src/app/bien-etre/* et écran de validation) : ses écrans, bibliothèques et traductions
 * restent hors du chargement initial de la PWA.
 */
import { registerUiStrings } from '@/lib/l10n';
import { UI_STRINGS_BIEN_ETRE } from '@/lib/ui-strings-bien-etre';

registerUiStrings(UI_STRINGS_BIEN_ETRE);

export { default as Hub } from './screens/hub';
export { default as Respiration } from './screens/respiration';
export { default as Meditation } from './screens/meditation';
export { default as Jeux } from './screens/jeux';
export { default as Noms } from './screens/noms';
export { default as Tajwid } from './screens/tajwid';
export { default as Gratitude } from './screens/gratitude';
export { bienEtreRows } from '@/lib/review-bien-etre';
