import { Platform } from 'react-native';
import type { Place } from './prayer';

type LocationMod = typeof import('expo-location');
// iPhone : chargé à l’évaluation, comme l’import précédent. Apple TV n’a pas ce pod.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Location: LocationMod | null = Platform.isTV ? null : (require('expo-location') as LocationMod);

/** Position GPS (avec permission). Renvoie null en cas de refus : l'app garde la dernière position connue. */
export async function getGpsPlace(): Promise<Place | null> {
  if (!Location) return null;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      // ≈ 110 m : largement suffisant pour les horaires et la qibla, et reste sur l'appareil.
      lat: Math.round(pos.coords.latitude * 1e3) / 1e3,
      lng: Math.round(pos.coords.longitude * 1e3) / 1e3,
      label: `GPS ${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
      source: 'gps',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
