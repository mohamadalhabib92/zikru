/**
 * Météo actuelle via Open-Meteo (OpenMeteo GmbH, Suisse — gratuit, sans clé, https://open-meteo.com).
 * Confidentialité : appelée seulement après consentement « météo » (voir lib/consent.ts), et avec une
 * position ARRONDIE à 0,1° (≈ 11 km). Le nom de ville est déterminé localement (ville connue la plus
 * proche) : plus aucun géocodage inverse distant. Résultat mis en cache 30 min sur l'appareil.
 */
import { CITIES } from './prayer';
import { coarsePoint, nearestCityLabel } from './privacy';
import { loadJSON, saveJSON } from './storage';

export type Weather = { temp: number; code: number; isDay: boolean; wind: number; feels?: number | null; max: number | null; min: number | null; city: string | null; at: number; lat: number; lng: number };

const KEY = 'weather-cache';
const TTL = 30 * 60 * 1000;

/** Codes météo OMM (WMO) utilisés par Open-Meteo → libellé français + icône Ionicons. */
export function wmo(code: number, isDay = true): { label: string; icon: string } {
  const sun = isDay ? 'sunny-outline' : 'moon-outline';
  const partly = isDay ? 'partly-sunny-outline' : 'cloudy-night-outline';
  if (code === 0) return { label: 'Ciel dégagé', icon: sun };
  if (code === 1) return { label: 'Plutôt dégagé', icon: partly };
  if (code === 2) return { label: 'Partiellement nuageux', icon: partly };
  if (code === 3) return { label: 'Couvert', icon: 'cloudy-outline' };
  if (code === 45 || code === 48) return { label: 'Brouillard', icon: 'cloudy-outline' };
  if (code >= 51 && code <= 57) return { label: 'Bruine', icon: 'rainy-outline' };
  if (code >= 61 && code <= 67) return { label: 'Pluie', icon: 'rainy-outline' };
  if (code >= 71 && code <= 77) return { label: 'Neige', icon: 'snow-outline' };
  if (code >= 80 && code <= 82) return { label: 'Averses', icon: 'rainy-outline' };
  if (code === 85 || code === 86) return { label: 'Averses de neige', icon: 'snow-outline' };
  if (code >= 95) return { label: 'Orage', icon: 'thunderstorm-outline' };
  return { label: '—', icon: 'cloud-outline' };
}

/** URL Open-Meteo construite UNIQUEMENT à partir de coordonnées arrondies (testé). */
export function weatherUrl(lat: number, lng: number): string {
  const c = coarsePoint(lat, lng);
  return `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
}

export async function getWeather(rawLat: number, rawLng: number, fallbackCity: string, force = false): Promise<Weather> {
  const { lat, lng } = coarsePoint(rawLat, rawLng);
  const cached = await loadJSON<Weather | null>(KEY, null);
  const near = cached && Math.abs(cached.lat - lat) < 0.05 && Math.abs(cached.lng - lng) < 0.05;
  if (cached && near && !force && cached.feels !== undefined && Date.now() - cached.at < TTL) return cached;
  const r = await fetch(weatherUrl(lat, lng));
  if (!r.ok) {
    if (cached) return cached;
    throw new Error(`Open-Meteo ${r.status}`);
  }
  const j = (await r.json()) as {
    current: { temperature_2m: number; apparent_temperature?: number; weather_code: number; is_day: number; wind_speed_10m: number };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  };
  const city = fallbackCity.startsWith('GPS ') ? nearestCityLabel({ lat: rawLat, lng: rawLng }, CITIES) ?? fallbackCity : fallbackCity;
  const w: Weather = {
    temp: j.current.temperature_2m,
    code: j.current.weather_code,
    isDay: j.current.is_day === 1,
    wind: j.current.wind_speed_10m,
    feels: j.current.apparent_temperature ?? null,
    max: j.daily?.temperature_2m_max?.[0] ?? null,
    min: j.daily?.temperature_2m_min?.[0] ?? null,
    city,
    at: Date.now(),
    lat,
    lng,
  };
  await saveJSON(KEY, w);
  return w;
}
