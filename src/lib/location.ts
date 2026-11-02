import * as Location from 'expo-location';
import { distanceKm, type Place } from './prayer';

/** Position GPS (avec permission). Renvoie null en cas de refus : l'app garde la dernière position connue. */
export async function getGpsPlace(): Promise<Place | null> {
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

/**
 * Vrai si la dernière position déjà connue est à moins de `radiusKm` du lieu (défaut 400 m).
 * N'affiche pas de demande de permission et n'interroge pas le GPS : aucun suivi en arrière-plan.
 */
export async function nearKnownPlace(target: { lat: number; lng: number } | null | undefined, radiusKm = 0.4): Promise<boolean> {
  if (!target) return false;
  try {
    const read = (Location as { getLastKnownPositionAsync?: () => Promise<{ coords: { latitude: number; longitude: number } } | null> }).getLastKnownPositionAsync;
    if (!read) return false;
    const pos = await read();
    if (!pos) return false;
    return distanceKm(pos.coords.latitude, pos.coords.longitude, target.lat, target.lng) <= radiusKm;
  } catch {
    return false;
  }
}
