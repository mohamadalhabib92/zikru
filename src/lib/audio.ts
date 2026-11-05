/**
 * Voix Bilal / adhan.
 *
 * Voix publiées : src/lib/adhan-voices.ts (HTTPS, licence citée sous le lecteur).
 * Aucun adhan n’est synthétisé.
 *
 * Fichiers locaux — déposer le mp3 puis remplacer `null` par require(...).
 * Un require vers un fichier absent casse le bundle. Noms attendus :
 *   assets/audio/bilal.mp3            → local-bilal
 *   assets/audio/adhan-makkah.mp3     → local-makkah
 *   assets/audio/adhan-madinah.mp3    → local-madinah
 * Exemple : 'local-bilal': require('../../assets/audio/bilal.mp3'),
 * Un fichier local présent est proposé en plus, en tête de liste.
 *
 * EXPO_PUBLIC_ADHAN_AUDIO_URL : voix supplémentaire si la valeur n’est pas vide
 * et ne commence pas par YOUR_. Les droits de ce fichier restent à la charge
 * de qui renseigne l’adresse.
 */
import { env } from './config';
import {
  DEFAULT_ADHAN_VOICE_ID,
  assembleAdhanVoices,
  resolveAdhanVoice,
  type AdhanVoice,
} from './adhan-voices';

const LOCAL_ADHAN: Record<string, number | null> = {
  'local-bilal': null,
  'local-makkah': null,
  'local-madinah': null,
};

const REMOTE = env('EXPO_PUBLIC_ADHAN_AUDIO_URL', process.env.EXPO_PUBLIC_ADHAN_AUDIO_URL);

export type { AdhanVoice };
export { DEFAULT_ADHAN_VOICE_ID };

export function adhanVoices(): AdhanVoice[] {
  return assembleAdhanVoices(LOCAL_ADHAN, REMOTE.value);
}

export function selectedAdhanVoice(id: string | undefined): AdhanVoice {
  return resolveAdhanVoice(id, adhanVoices());
}

/** Source de la voix par défaut. Le lecteur utilise la voix enregistrée dans les réglages. */
export const BILAL_SOURCE = selectedAdhanVoice(DEFAULT_ADHAN_VOICE_ID).source;
