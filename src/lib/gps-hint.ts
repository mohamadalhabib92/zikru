/** Délai au-delà duquel « Utiliser ma position » s’arrête au lieu de tourner sans fin. */
export const GPS_TIMEOUT_MS = 12_000;

export type GpsFailure = 'denied' | 'unavailable';

export const GPS_DENIED = 'Position refusée. Autorisez la localisation dans les réglages du téléphone, ou choisissez une ville.';
export const GPS_UNAVAILABLE = 'Position indisponible. Sans signal ou hors ligne, choisissez une ville : les horaires restent calculés sur l’appareil.';

export function gpsHint(reason: GpsFailure): string {
  return reason === 'denied' ? GPS_DENIED : GPS_UNAVAILABLE;
}
