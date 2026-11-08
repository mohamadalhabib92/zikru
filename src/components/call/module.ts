/**
 * Point d’entrée unique des appels de groupe (v1), importé seulement par import() dynamique (route /call) :
 * écran, WebRTC / LiveKit et traductions restent hors du chargement initial. Rien d’autre dans l’app n’en dépend.
 */
import { registerUiStrings } from '@/lib/l10n';
import { UI_STRINGS_CALL } from '@/lib/ui-strings-call';

registerUiStrings(UI_STRINGS_CALL);

export { default as CallScreen } from './call-screen';
