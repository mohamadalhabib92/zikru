import * as Location from 'expo-location';
import type { Place } from './prayer';

/** Position GPS (avec permission). Renvoie null en cas de refus : l'app garde la dernière position connue. */
export async function getGpsPlace(): Promise<Place | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      lat: Math.round(pos.coords.latitude * 1e4) / 1e4,
      lng: Math.round(pos.coords.longitude * 1e4) / 1e4,
      label: `GPS ${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
      source: 'gps',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
