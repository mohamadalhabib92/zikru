import { CalculationMethod, CalculationParameters, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, Qibla } from 'adhan';

/**
 * Horaires calculés 100 % hors-ligne (bibliothèque open-source « adhan », MIT). Aucun appel réseau.
 * UOIF : 12° / 12°, angles couramment publiés — à valider, pas une décision de Zikru.
 * La méthode par défaut pour la Suisse est YOUR_DEFAULT_PRAYER_METHOD (à trancher par Mohamed).
 * Tant qu'elle n'est pas une clé connue, le repli technique est Muslim World League : ce n'est pas une norme officielle.
 */
export const METHODS = {
  MuslimWorldLeague: 'Muslim World League (Fajr 18°, Isha 17°)',
  UOIF: 'UOIF — France (12° / 12°) — à valider',
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

export const DEFAULT_METHOD_PLACEHOLDER = 'YOUR_DEFAULT_PRAYER_METHOD';
/** Repli technique uniquement. Ne pas présenter comme méthode officielle suisse. */
export const TECHNICAL_DEFAULT_METHOD: MethodKey = 'MuslimWorldLeague';

export function resolveDefaultMethod(raw = process.env.EXPO_PUBLIC_DEFAULT_PRAYER_METHOD): MethodKey {
  const v = (raw ?? '').trim();
  if (v && !v.startsWith('YOUR_') && v in METHODS) return v as MethodKey;
  return TECHNICAL_DEFAULT_METHOD;
}

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export type PrayerState = 'past' | 'current' | 'next' | 'upcoming';

export type HighLatKey = 'recommended' | 'middle' | 'seventh' | 'angle';
export const HIGH_LAT_KEYS: HighLatKey[] = ['recommended', 'middle', 'seventh', 'angle'];

/** Minutes ajoutées au calcul (pas aux heures de mosquée). Bornes ±90. */
export type MinuteAdjustments = Partial<Record<PrayerKey, number>>;
export const ADJUST_LIMIT = 90;
export function clampAdjust(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-ADJUST_LIMIT, Math.min(ADJUST_LIMIT, Math.round(n)));
}

/** Heures saisies à la main (HH:MM). Prioritaires sur le calcul quand `enabled`. */
export type MosqueTimetable = { enabled: boolean; label: string; times: Partial<Record<PrayerKey, string>> };

export type PrayerOptions = {
  highLat?: HighLatKey;
  adjustments?: MinuteAdjustments | null;
  mosque?: MosqueTimetable | null;
};

export function prayerOptionsOf(s: { highLat?: HighLatKey; adjustments?: MinuteAdjustments | null; mosque?: MosqueTimetable | null }): PrayerOptions {
  return { highLat: s.highLat ?? 'recommended', adjustments: s.adjustments ?? undefined, mosque: s.mosque?.enabled ? s.mosque : null };
}

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

function methodParams(method: MethodKey): CalculationParameters {
  if (method === 'UOIF') {
    const p = CalculationMethod.Other();
    p.fajrAngle = 12;
    p.ishaAngle = 12;
    return p;
  }
  return CalculationMethod[method]();
}

/** HH:MM sur le jour civil de `day`, ou null si la saisie est vide ou illisible. */
export function clockOn(day: Date, hhmm: string | undefined | null): Date | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min, 0, 0);
}

export function computeDay(date: Date, place: Place, method: MethodKey, madhab: 'shafi' | 'hanafi', opt: PrayerOptions = {}) {
  const coords = new Coordinates(place.lat, place.lng);
  const params = methodParams(method in METHODS ? method : TECHNICAL_DEFAULT_METHOD);
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  const rule = opt.highLat ?? 'recommended';
  params.highLatitudeRule =
    rule === 'middle' ? HighLatitudeRule.MiddleOfTheNight : rule === 'seventh' ? HighLatitudeRule.SeventhOfTheNight : rule === 'angle' ? HighLatitudeRule.TwilightAngle : HighLatitudeRule.recommended(coords);
  for (const key of PRAYER_KEYS) {
    const n = opt.adjustments?.[key];
    if (n) params.adjustments[key] = clampAdjust(n);
  }
  const pt = new PrayerTimes(coords, date, params);
  const mosqueOn = !!opt.mosque?.enabled;
  return PRAYER_KEYS.map((key) => {
    const calculated = pt[key] as Date;
    const manual = mosqueOn ? clockOn(date, opt.mosque?.times?.[key]) : null;
    return { key, time: manual ?? calculated, source: (manual ? 'mosque' : 'calc') as 'mosque' | 'calc' };
  });
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

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const [la1, lo1, la2, lo2] = [aLat, aLng, bLat, bLng].map((d) => (d * Math.PI) / 180);
  const a = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function distanceToKaabaKm(place: Place): number {
  return distanceKm(place.lat, place.lng, 21.4225, 39.8262);
}

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export function countdown(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

export const AR_NAMES: Record<PrayerKey, string> = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
