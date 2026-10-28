/**
 * Planification des rappels (prières + rappels optionnels) — module pur, sans dépendance, testé par scripts/test-notify.mjs.
 * iOS limite à 64 notifications locales programmées : on remplit jour après jour jusqu’à MAX, puis on ajoute
 * un dernier rappel « ouvrez Zikru » ; la planification est refaite à chaque ouverture, changement de réglage et à minuit.
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
};
export type QuranSlot = 'off' | 'fajr' | 'isha';
export const DEFAULT_NOTIF: NotifPrefs = { prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, before: 0, friday: true, adhkar: false, wird: false, quran: 'off' };
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
};

export type PlannedNotif = { id: string; date: Date; title: string; body: string; url: string; kind: 'prayer' | 'before' | 'friday' | 'adhkar' | 'wird' | 'quran' | 'paused' };
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
    if (!t || !prefs.prayers[k]) continue;
    out.push({ id: `${dk}-${k}`, date: t, title: `${L.prayer[k]} · ${L.place}`, body: L.atTime, url: '/prayers', kind: 'prayer' });
    if (prefs.before > 0) out.push({ id: `${dk}-${k}-pre`, date: new Date(t.getTime() - prefs.before * MIN), title: `${L.prayer[k]} ${L.inMin(prefs.before)}`, body: L.place, url: '/prayers', kind: 'before' });
  }
  const fajr = at('fajr'), sunrise = at('sunrise'), dhuhr = at('dhuhr'), asr = at('asr'), maghrib = at('maghrib');
  if (prefs.friday && friday) {
    if (sunrise) out.push({ id: `${dk}-kahf`, date: new Date(sunrise.getTime() + 60 * MIN), title: L.kahfTitle, body: L.kahfBody, url: '/kahf', kind: 'friday' });
    if (dhuhr) out.push({ id: `${dk}-jumua`, date: new Date(dhuhr.getTime() - 45 * MIN), title: L.jumuaTitle, body: L.jumuaBody, url: '/prayers', kind: 'friday' });
  }
  if (prefs.adhkar) {
    if (fajr) out.push({ id: `${dk}-adhkar-am`, date: new Date((sunrise ?? fajr).getTime() - 20 * MIN), title: L.morningTitle, body: L.adhkarBody, url: '/dhikr', kind: 'adhkar' });
    if (asr) out.push({ id: `${dk}-adhkar-pm`, date: new Date(asr.getTime() + 20 * MIN), title: L.eveningTitle, body: L.adhkarBody, url: '/dhikr', kind: 'adhkar' });
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
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Plan glissant : à partir de `now`, jour après jour, sans dépasser `max` (63 par défaut, + 1 rappel « en pause »).
 * Un jour n’est ajouté que s’il tient entièrement, pour ne jamais couper une journée au milieu.
 */
export function buildPlan(now: Date, compute: ComputeDay, prefs: NotifPrefs, L: PlanLabels, max = 63, maxDays = 30): PlannedNotif[] {
  const out: PlannedNotif[] = [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  let lastDay = start;
  for (let i = 0; i < maxDays; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
    const ev = eventsForDay(day, compute(day), prefs, L).filter((e) => e.date.getTime() > now.getTime() + 5000);
    if (out.length + ev.length > max) break;
    out.push(...ev);
    lastDay = day;
  }
  if (out.length) {
    const next = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1, 12);
    const fajr = compute(next).find((x) => x.key === 'fajr')?.time ?? new Date(next.getTime() - 4 * 3600000);
    out.push({ id: `${dayKey(next)}-paused`, date: fajr, title: L.pausedTitle, body: L.pausedBody, url: '/settings', kind: 'paused' });
  }
  return out;
}

/** Empreinte du plan : évite de tout reprogrammer si rien n’a changé. */
export const planHash = (p: PlannedNotif[]) => p.map((e) => `${e.id}@${Math.round(e.date.getTime() / MIN)}:${e.title}`).join('|');
