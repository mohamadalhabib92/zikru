/**
 * Voix Bilal / adhan. Aucun fichier audio n'est fourni dans ce dépôt (assets finaux à livrer
 * par Mohamed). Pour l'activer :
 *   1. déposer le fichier dans assets/audio/ (ex. bilal.mp3) ;
 *   2. remplacer `null` ci-dessous par require('../../assets/audio/bilal.mp3').
 * Alternative : EXPO_PUBLIC_ADHAN_AUDIO_URL (URL https d'un fichier dont vous détenez les droits).
 * Tant que rien n'est fourni, le lecteur affiche « fichier manquant » et ne plante pas.
 */
import { env } from './config';
const LOCAL_BILAL: number | null = null;
const REMOTE = env('EXPO_PUBLIC_ADHAN_AUDIO_URL', process.env.EXPO_PUBLIC_ADHAN_AUDIO_URL);
export const BILAL_SOURCE: number | { uri: string } | null = LOCAL_BILAL ?? (REMOTE.value ? { uri: REMOTE.value } : null);
