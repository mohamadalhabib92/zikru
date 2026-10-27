/**
 * Météo actuelle via Open-Meteo (gratuit, sans clé, https://open-meteo.com) et nom de ville
 * via BigDataCloud reverse-geocode-client (sans clé). Résultat mis en cache 30 min sur l'appareil.
 */
import { loadJSON, saveJSON } from './storage';

export type Weather = { temp: number; code: number; isDay: boolean; wind: number; max: number | null; min: number | null; city: string | null; at: number; lat: number; lng: number };

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

async function cityFor(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`https://api-bdc.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=fr`);
    if (!r.ok) return null;
    const j = (await r.json()) as { city?: string; locality?: string };
    return j.city || j.locality || null;
  } catch {
    return null;
  }
}

export async function getWeather(lat: number, lng: number, fallbackCity: string, force = false): Promise<Weather> {
  const cached = await loadJSON<Weather | null>(KEY, null);
  const near = cached && Math.abs(cached.lat - lat) < 0.05 && Math.abs(cached.lng - lng) < 0.05;
  if (cached && near && !force && Date.now() - cached.at < TTL) return cached;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
  const r = await fetch(url);
  if (!r.ok) {
    if (cached) return cached;
    throw new Error(`Open-Meteo ${r.status}`);
  }
  const j = (await r.json()) as {
    current: { temperature_2m: number; weather_code: number; is_day: number; wind_speed_10m: number };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  };
  const city = (near && cached?.city) || (await cityFor(lat, lng)) || fallbackCity;
  const w: Weather = {
    temp: j.current.temperature_2m,
    code: j.current.weather_code,
    isDay: j.current.is_day === 1,
    wind: j.current.wind_speed_10m,
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
