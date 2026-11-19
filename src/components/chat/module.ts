/**
 * Point d’entrée unique de la discussion de groupe (Passe 5), importé seulement par import() dynamique
 * (route /discussion) : écran, file hors ligne, temps réel et traductions restent hors du chargement initial.
 */
import { registerUiStrings } from '@/lib/l10n';
import { UI_STRINGS_CHAT } from '@/lib/ui-strings-chat';

registerUiStrings(UI_STRINGS_CHAT);

export { default as Discussion } from './discussion';
