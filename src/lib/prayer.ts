import { CalculationMethod, CalculationParameters, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, Qibla } from 'adhan';

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
  UOIF: 'UOIF / Musulmans de France (12° / 12°)',
} as const;
export type MethodKey = keyof typeof METHODS;

/** Méthodes sans fabrique « adhan » : angles publiés (UOIF = 12°/12°, méthode 12 d’AlAdhan / PrayTimes). */
const CUSTOM: Partial<Record<MethodKey, { fajr: number; isha: number }>> = { UOIF: { fajr: 12, isha: 12 } };

export const isMethodKey = (k: unknown): k is MethodKey => typeof k === 'string' && Object.prototype.hasOwnProperty.call(METHODS, k);

/** Règle hautes latitudes (Fajr/Isha quand le crépuscule ne finit pas) : « auto » = recommandée par adhan selon la latitude. */
export const HIGH_LAT_RULES = ['auto', 'middleofthenight', 'seventhofthenight', 'twilightangle'] as const;
export type HighLatChoice = (typeof HIGH_LAT_RULES)[number];

/** Options locales de calcul : ajustements ±minutes et horaires fixes de la mosquée (prioritaires sur le calcul). */
export type PrayerOpts = {
  highLat?: HighLatChoice;
  /** Minutes ajoutées à l’heure calculée (−30…+30), par prière. Sans effet sur un horaire de mosquée. */
  adjust?: Partial<Record<PrayerKey, number>>;
  mosque?: { enabled: boolean; name?: string; times: Partial<Record<PrayerKey, string>> };
};
export const DEFAULT_PRAYER_OPTS: PrayerOpts = { highLat: 'auto', adjust: {}, mosque: { enabled: false, times: {} } };
export const ADJUST_LIMIT = 30;

/** « HH:MM » valide → minutes depuis minuit, sinon null. */
export function parseHHMM(v: string | undefined | null): number | null {
  const m = /^\s*(\d{1,2})[:h.](\d{2})\s*$/.exec(v ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}
export const clampAdj = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(-ADJUST_LIMIT, Math.min(ADJUST_LIMIT, Math.round(n))) : 0);

export type PrayerRow = { key: PrayerKey; time: Date; source: 'calc' | 'mosque' };

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

export function computeDay(date: Date, place: Place, method: MethodKey, madhab: 'shafi' | 'hanafi', opts?: PrayerOpts): PrayerRow[] {
  const coords = new Coordinates(place.lat, place.lng);
  const key = isMethodKey(method) ? method : 'MuslimWorldLeague';
  const custom = CUSTOM[key];
  const params = custom ? new CalculationParameters('Other', custom.fajr, custom.isha) : CalculationMethod[key as Exclude<MethodKey, 'UOIF'>]();
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  const hl = opts?.highLat;
  params.highLatitudeRule = hl && hl !== 'auto' && HIGH_LAT_RULES.includes(hl) ? hl : HighLatitudeRule.recommended(coords);
  for (const k of PRAYER_KEYS) params.adjustments[k] = clampAdj(opts?.adjust?.[k]);
  const pt = new PrayerTimes(coords, date, params);
  const rows: PrayerRow[] = PRAYER_KEYS.map((k) => ({ key: k, time: pt[k] as Date, source: 'calc' }));
  const mosque = opts?.mosque;
  if (!mosque?.enabled) return rows;
  // Horaires de ma mosquée : prioritaires, sauf s’ils cassent l’ordre de la journée (saisie erronée → calcul conservé).
  const out = rows.map((r) => {
    const min = parseHHMM(mosque.times?.[r.key]);
    if (min == null) return r;
    return { key: r.key, time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(min / 60), min % 60, 0, 0), source: 'mosque' as const };
  });
  for (let guard = 0; guard < out.length; guard++) {
    const bad = out.findIndex((r, i) => i > 0 && r.time.getTime() <= out[i - 1].time.getTime());
    if (bad === -1) break;
    const j = out[bad].source === 'mosque' ? bad : bad - 1;
    out[j] = rows[j];
  }
  return out;
}

/** États passé / actuel / prochain — un seul calcul pour tous les écrans. */
export function withStates<T extends { key: PrayerKey; time: Date }>(list: T[], now: Date, tomorrowFajr: Date) {
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
