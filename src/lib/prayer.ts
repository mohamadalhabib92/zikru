import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, Qibla } from 'adhan';

/** Horaires calculés 100 % hors-ligne (bibliothèque open-source « adhan », MIT). Aucun appel réseau. */
export const METHODS = {
  MuslimWorldLeague: 'Muslim World League (Fajr 18°, Isha 17°)',
  Egyptian: 'Egyptian General Authority of Survey (19,5° / 17,5°)',
  Karachi: 'University of Islamic Sciences, Karachi (18° / 18°)',
  UmmAlQura: 'Umm al-Qura, La Mecque (18,5° / 90 min)',
  Dubai: 'Dubaï (18,2° / 18,2°)',
  MoonsightingCommittee: 'Moonsighting Committee Worldwide',
  NorthAmerica: 'ISNA — Amérique du Nord (15° / 15°)',
  Kuwait: 'Koweït (18° / 17,5°)',
  Qatar: 'Qatar (18° / 90 min)',
  Singapore: 'Singapour (20° / 18°)',
  Turkey: 'Diyanet — Turquie',
  Tehran: 'Institut de géophysique, Téhéran',
} as const;
export type MethodKey = keyof typeof METHODS;

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export type PrayerState = 'past' | 'current' | 'next' | 'upcoming';

export type Place = { lat: number; lng: number; label: string; source: 'gps' | 'manual' | 'example'; updatedAt?: string };

export const CITIES: Place[] = [
  { label: 'Lausanne', lat: 46.5197, lng: 6.6323, source: 'manual' },
  { label: 'Genève', lat: 46.2044, lng: 6.1432, source: 'manual' },
  { label: 'Prilly', lat: 46.5363, lng: 6.6031, source: 'manual' },
  { label: 'Fribourg', lat: 46.8065, lng: 7.1619, source: 'manual' },
  { label: 'Neuchâtel', lat: 46.99, lng: 6.9293, source: 'manual' },
  { label: 'Sion', lat: 46.2331, lng: 7.3606, source: 'manual' },
  { label: 'Berne', lat: 46.948, lng: 7.4474, source: 'manual' },
  { label: 'Bâle', lat: 47.5596, lng: 7.5886, source: 'manual' },
  { label: 'Zurich', lat: 47.3769, lng: 8.5417, source: 'manual' },
  { label: 'Lugano', lat: 46.0037, lng: 8.9511, source: 'manual' },
  { label: 'Dakar', lat: 14.7167, lng: -17.4677, source: 'manual' },
  { label: 'Nouakchott', lat: 18.0735, lng: -15.9582, source: 'manual' },
  { label: 'Bamako', lat: 12.6392, lng: -8.0029, source: 'manual' },
  { label: 'Paris', lat: 48.8566, lng: 2.3522, source: 'manual' },
];
export const DEFAULT_PLACE: Place = { ...CITIES[0], source: 'example' };

export function computeDay(date: Date, place: Place, method: MethodKey, madhab: 'shafi' | 'hanafi') {
  const coords = new Coordinates(place.lat, place.lng);
  const params = CalculationMethod[method]();
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(coords);
  const pt = new PrayerTimes(coords, date, params);
  return PRAYER_KEYS.map((key) => ({ key, time: pt[key] as Date }));
}

/** États passé / actuel / prochain — un seul calcul pour tous les écrans. */
export function withStates(list: { key: PrayerKey; time: Date }[], now: Date, tomorrowFajr: Date) {
  let nextIdx = list.findIndex((p) => p.time.getTime() > now.getTime());
  const currentIdx = nextIdx === -1 ? list.length - 1 : nextIdx - 1;
  const rows = list.map((p, i) => ({
    ...p,
    state: (i === currentIdx && p.key !== 'sunrise' ? 'current' : i === nextIdx ? 'next' : i < (nextIdx === -1 ? list.length : nextIdx) ? 'past' : 'upcoming') as PrayerState,
  }));
  const next = nextIdx === -1 ? { key: 'fajr' as PrayerKey, time: tomorrowFajr } : list[nextIdx];
  return { rows, next };
}

export function qiblaBearing(place: Place): number {
  return Qibla(new Coordinates(place.lat, place.lng));
}

export function distanceToKaabaKm(place: Place): number {
  const R = 6371;
  const [la1, lo1, la2, lo2] = [place.lat, place.lng, 21.4225, 39.8262].map((d) => (d * Math.PI) / 180);
  const a = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export function countdown(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

export const AR_NAMES: Record<PrayerKey, string> = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
