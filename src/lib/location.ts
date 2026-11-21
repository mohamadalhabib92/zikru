import { Platform } from 'react-native';
import { GPS_TIMEOUT_MS, type GpsFailure } from './gps-hint';
import type { Place } from './prayer';

type LocationMod = typeof import('expo-location');
// iPhone : chargé à l’évaluation, comme l’import précédent. Apple TV n’a pas ce pod.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Location: LocationMod | null = Platform.isTV ? null : (require('expo-location') as LocationMod);

export type GpsRead = { ok: true; place: Place } | { ok: false; reason: GpsFailure };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Position GPS. Refus, absence de signal ou délai dépassé : la dernière ville reste en place.
 * Les coordonnées sont arrondies (~110 m) et ne quittent pas l’appareil.
 */
export async function readGpsPlace(): Promise<GpsRead> {
  if (!Location) return { ok: false, reason: 'unavailable' };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, reason: 'denied' };
    const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), GPS_TIMEOUT_MS);
    if (!pos) return { ok: false, reason: 'unavailable' };
    return {
      ok: true,
      place: {
        lat: Math.round(pos.coords.latitude * 1e3) / 1e3,
        lng: Math.round(pos.coords.longitude * 1e3) / 1e3,
        label: `GPS ${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
        source: 'gps',
        updatedAt: new Date().toISOString(),
      },
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Position GPS, ou null si elle n’est pas disponible. L’app garde alors la dernière position connue. */
export async function getGpsPlace(): Promise<Place | null> {
  const r = await readGpsPlace();
  return r.ok ? r.place : null;
}
