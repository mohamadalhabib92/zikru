/**
 * Planification des rappels (prières + rappels optionnels) — module pur, sans dépendance, testé par scripts/test-notify.mjs.
 * iOS limite à 64 notifications locales programmées. Plan glissant PRIORISÉ :
 *  1. les adhans des prières obligatoires d’aujourd’hui + 7 jours pleins (≤ 40) passent en premier ;
 *  2. puis les rappels secondaires (avant l’adhan, vendredi, adhkar, wird, Coran), jour entier par jour entier, du plus proche au plus lointain ;
 *  3. s’il reste de la place, des jours complets supplémentaires ;
 *  + un dernier rappel « ouvrez Zikru » après le dernier jour couvert.
 * La planification est refaite à chaque ouverture, changement de réglage et à minuit.
 */
export type FardKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const FARD_KEYS: FardKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type NotifPrefs = {
  /** Une case par prière obligatoire. */
  prayers: Record<FardKey, boolean>;
  /** Rappel X minutes avant l’adhan (0 = désactivé). */
  before: number;
  /** Vendredi : sourate al-Kahf le matin + Jumu‘a 45 min avant le Dhuhr. */
  friday: boolean;
  /** Adhkar du matin (après Fajr) et du soir (après ‘Asr). */
  adhkar: boolean;
  /** Wird al-Lazim matin et soir, Wazifa après le Maghrib, Hailala le vendredi. */
  wird: boolean;
  /** Lecture du Coran (khatma / révision hifz) : après le Fajr, après le ‘Isha, ou désactivé. */
  quran?: QuranSlot;
  /** Heures calmes : aucun rappel secondaire dans le créneau (les adhans restent réglés prière par prière). */
  quiet?: QuietHours;
  /** Bilan privé de la semaine, le dimanche à 19 h (désactivé par défaut). */
  recap?: boolean;
};
export type QuietHours = { on: boolean; from: string; to: string };
export const DEFAULT_QUIET: QuietHours = { on: false, from: '22:30', to: '06:30' };
export type QuranSlot = 'off' | 'fajr' | 'isha';
export const DEFAULT_NOTIF: NotifPrefs = { prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, before: 0, friday: true, adhkar: false, wird: false, quran: 'off', quiet: DEFAULT_QUIET, recap: false };
export const BEFORE_OPTIONS = [0, 5, 10, 15, 30];

export type PlanLabels = {
  prayer: Record<FardKey, string>;
  place: string;
  atTime: string; // « C’est l’heure de la prière. »
  inMin: (min: number) => string; // « dans 10 min »
  kahfTitle: string;
  kahfBody: string;
  jumuaTitle: string;
  jumuaBody: string;
  morningTitle: string;
  eveningTitle: string;
  adhkarBody: string;
  wirdMorning: string;
  wirdEvening: string;
  wazifa: string;
  hailala: string;
  wirdBody: string;
  quranTitle: string;
  quranBody: string;
  pausedTitle: string;
  pausedBody: string;
  recapTitle?: string;
  recapBody?: string;
};

export type PlannedNotif = { id: string; date: Date; title: string; body: string; url: string; kind: 'prayer' | 'before' | 'friday' | 'adhkar' | 'wird' | 'quran' | 'recap' | 'paused' };
type DayTimes = { key: string; time: Date }[];
export type ComputeDay = (d: Date) => DayTimes;

const MIN = 60000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Événements d’un jour civil, triés. */
export function eventsForDay(day: Date, times: DayTimes, prefs: NotifPrefs, L: PlanLabels): PlannedNotif[] {
  const at = (k: string) => times.find((x) => x.key === k)?.time;
  const dk = dayKey(day);
  const out: PlannedNotif[] = [];
  const friday = day.getDay() === 5;
  for (const k of FARD_KEYS) {
    const t = at(k);
    if (!t || !Number.isFinite(t.getTime()) || !prefs.prayers[k]) continue;
    out.push({ id: `${dk}-${k}`, date: t, title: `${L.prayer[k]} · ${L.place}`, body: L.atTime, url: '/prayers', kind: 'prayer' });
    if (prefs.before > 0) out.push({ id: `${dk}-${k}-pre`, date: new Date(t.getTime() - prefs.before * MIN), title: `${L.prayer[k]} ${L.inMin(prefs.before)}`, body: L.place, url: '/prayers', kind: 'before' });
  }
  const fajr = at('fajr'), sunrise = at('sunrise'), dhuhr = at('dhuhr'), asr = at('asr'), maghrib = at('maghrib');
  if (prefs.friday && friday) {
    if (sunrise) out.push({ id: `${dk}-kahf`, date: new Date(sunrise.getTime() + 60 * MIN), title: L.kahfTitle, body: L.kahfBody, url: '/kahf', kind: 'friday' });
    if (dhuhr) out.push({ id: `${dk}-jumua`, date: new Date(dhuhr.getTime() - 45 * MIN), title: L.jumuaTitle, body: L.jumuaBody, url: '/prayers', kind: 'friday' });
  }
  if (prefs.adhkar) {
    if (fajr) out.push({ id: `${dk}-adhkar-am`, date: new Date((sunrise ?? fajr).getTime() - 20 * MIN), title: L.morningTitle, body: L.adhkarBody, url: '/adhkar?m=matin', kind: 'adhkar' });
    if (asr) out.push({ id: `${dk}-adhkar-pm`, date: new Date(asr.getTime() + 20 * MIN), title: L.eveningTitle, body: L.adhkarBody, url: '/adhkar?m=soir', kind: 'adhkar' });
  }
  if (prefs.wird) {
    if (fajr) out.push({ id: `${dk}-wird-am`, date: new Date(fajr.getTime() + 30 * MIN), title: L.wirdMorning, body: L.wirdBody, url: '/tijani?tab=wird', kind: 'wird' });
    if (asr) out.push({ id: `${dk}-wird-pm`, date: new Date(asr.getTime() + 30 * MIN), title: L.wirdEvening, body: L.wirdBody, url: '/tijani?tab=wird', kind: 'wird' });
    if (friday && asr) out.push({ id: `${dk}-hailala`, date: new Date(asr.getTime() + 45 * MIN), title: L.hailala, body: L.wirdBody, url: '/tijani?tab=hailala', kind: 'wird' });
    if (maghrib) out.push({ id: `${dk}-wazifa`, date: new Date(maghrib.getTime() + 30 * MIN), title: L.wazifa, body: L.wirdBody, url: '/tijani?tab=wazifa', kind: 'wird' });
  }
  const isha = at('isha');
  if (prefs.quran === 'fajr' && fajr) out.push({ id: `${dk}-quran`, date: new Date(fajr.getTime() + 45 * MIN), title: L.quranTitle, body: L.quranBody, url: '/quran', kind: 'quran' });
  if (prefs.quran === 'isha' && isha) out.push({ id: `${dk}-quran`, date: new Date(isha.getTime() + 30 * MIN), title: L.quranTitle, body: L.quranBody, url: '/quran', kind: 'quran' });
  if (prefs.recap && day.getDay() === 0 && L.recapTitle)
    out.push({ id: `${dk}-recap`, date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 19, 0), title: L.recapTitle, body: L.recapBody ?? '', url: '/goals', kind: 'recap' });
  return applyQuiet(out.filter((e) => Number.isFinite(e.date.getTime())), prefs.quiet).sort((a, b) => a.date.getTime() - b.date.getTime());
}

const hm = (v: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? '');
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
};
/** Vrai si l’heure locale de `d` tombe dans le créneau [from, to[ (qui peut passer minuit). */
export function inQuiet(d: Date, q?: QuietHours): boolean {
  if (!q?.on) return false;
  const a = hm(q.from), b = hm(q.to);
  if (a == null || b == null || a === b) return false;
  const x = d.getHours() * 60 + d.getMinutes();
  return a < b ? x >= a && x < b : x >= a || x < b;
}
/** Retire les rappels secondaires tombant dans les heures calmes ; les adhans (kind « prayer ») ne sont jamais retirés ici. */
export function applyQuiet(ev: PlannedNotif[], q?: QuietHours): PlannedNotif[] {
  return q?.on ? ev.filter((e) => e.kind === 'prayer' || !inQuiet(e.date, q)) : ev;
}

/**
 * Mode dispense (local) : pour un jour donné, « prayers » retire les rappels liés à la prière
 * (adhan, avant l’adhan, Jumu‘a) ; « all » retire aussi les autres rappels. Aucune règle de fiqh ici : c’est un choix de l’utilisateur.
 */
export type PauseLevel = 'none' | 'prayers' | 'all';
export type PauseFn = (day: Date) => PauseLevel;
const PRAYER_LINKED = (e: PlannedNotif) => e.kind === 'prayer' || e.kind === 'before' || e.id.endsWith('-jumua');
export function applyPause(ev: PlannedNotif[], level: PauseLevel): PlannedNotif[] {
  if (level === 'all') return [];
  if (level === 'prayers') return ev.filter((e) => !PRAYER_LINKED(e));
  return ev;
}

/** Jours où les adhans passent en priorité : aujourd’hui + 7 jours pleins. */
export const PRIORITY_DAYS = 8;

/**
 * Plan glissant priorisé (voir en-tête) : jamais plus de `max` (63) + 1 rappel « en pause » ≤ 64.
 * Un jour de rappels secondaires n’est ajouté que s’il tient entièrement (jamais de journée coupée au milieu).
 */
export function buildPlan(now: Date, compute: ComputeDay, prefs: NotifPrefs, L: PlanLabels, max = 63, maxDays = 30, pause?: PauseFn): PlannedNotif[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const days: { day: Date; ev: PlannedNotif[] }[] = [];
  for (let i = 0; i < maxDays; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
    const ev = eventsForDay(day, compute(day), prefs, L).filter((e) => e.date.getTime() > now.getTime() + 5000);
    days.push({ day, ev: applyPause(ev, pause?.(day) ?? 'none') });
  }
  const out: PlannedNotif[] = [];
  // 1. Adhans des prières obligatoires d’abord.
  let covered = -1;
  for (let i = 0; i < Math.min(PRIORITY_DAYS, days.length); i++) {
    const p = days[i].ev.filter((e) => e.kind === 'prayer');
    if (out.length + p.length > max) break;
    out.push(...p);
    covered = i;
  }
  // 2. Rappels secondaires de ces mêmes jours, du plus proche au plus lointain, par jours entiers.
  let complete = true;
  for (let i = 0; i <= covered; i++) {
    const sec = days[i].ev.filter((e) => e.kind !== 'prayer');
    if (out.length + sec.length > max) {
      complete = false;
      break;
    }
    out.push(...sec);
  }
  // 3. Jours complets supplémentaires tant qu’il reste de la place.
  if (complete && covered === Math.min(PRIORITY_DAYS, days.length) - 1) {
    for (let i = covered + 1; i < days.length; i++) {
      if (out.length + days[i].ev.length > max) break;
      out.push(...days[i].ev);
      covered = i;
    }
  }
  out.sort((x, y) => x.date.getTime() - y.date.getTime());
  if (out.length && covered >= 0) {
    const last = days[covered].day;
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1, 12);
    const f = compute(next).find((x) => x.key === 'fajr')?.time;
    const fajr = f && Number.isFinite(f.getTime()) ? f : new Date(next.getTime() - 4 * 3600000);
    out.push({ id: `${dayKey(next)}-paused`, date: fajr, title: L.pausedTitle, body: L.pausedBody, url: '/settings', kind: 'paused' });
  }
  return out;
}

/** Empreinte du plan : évite de tout reprogrammer si rien n’a changé. */
export const planHash = (p: PlannedNotif[]) => p.map((e) => `${e.id}@${Math.round(e.date.getTime() / MIN)}:${e.title}`).join('|');
