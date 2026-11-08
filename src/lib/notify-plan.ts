/**
 * Planification des rappels (prières + rappels optionnels) — module pur, sans dépendance, testé par scripts/test-notify.mjs.
 * iOS limite à 64 notifications locales programmées. Plan glissant PRIORISÉ :
 *  1. les adhans des prières obligatoires d’aujourd’hui + 7 jours pleins (≤ 40) passent en premier ;
 *  2. puis les rappels secondaires (avant l’adhan, vendredi, adhkar, wird, Coran), jour entier par jour entier, du plus proche au plus lointain ;
 *  3. s’il reste de la place, des jours complets supplémentaires ;
 *  + un dernier rappel « ouvrez Zikru » après le dernier jour couvert.
 * Ramadan (Pass 4, optionnel) : « fin du suhur » et « iftar » sont PRIORITAIRES comme les adhans (étape 1) ;
 * si l’adhan du Maghrib est activé, l’iftar le renomme (aucun créneau de plus). Heures calmes respectées,
 * sauf si l’utilisateur autorise explicitement le suhur / l’iftar pendant ces heures.
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
  /**
   * Joue la voix d’adhan choisie à l’heure des prières cochées.
   * Le rappel « avant », le vendredi, les adhkar et le wird ne lancent pas l’adhan.
   * Absent d’un ancien réglage : traité comme activé.
   */
  adhan?: boolean;
  /** Heures calmes : aucun rappel secondaire dans le créneau (les adhans restent réglés prière par prière). */
  quiet?: QuietHours;
  /** Bilan privé de la semaine, le dimanche à 19 h (désactivé par défaut). */
  recap?: boolean;
  /** Gratitude (bien-être) : rappel doux du soir à l’heure choisie, désactivé par défaut ; rappel secondaire (heures calmes respectées). */
  gratitude?: { on: boolean; at: string };
};
export type QuietHours = { on: boolean; from: string; to: string };
export const DEFAULT_QUIET: QuietHours = { on: false, from: '22:30', to: '06:30' };
export type QuranSlot = 'off' | 'fajr' | 'isha';
export const DEFAULT_NOTIF: NotifPrefs = { prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }, before: 0, friday: true, adhkar: false, wird: false, quran: 'off', adhan: true, quiet: DEFAULT_QUIET, recap: false, gratitude: { on: false, at: '21:00' } };
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
  /** Ramadan (facultatif) : « Suhur · fin à {t} », « Fajr calculé : {f} · {lieu} », « Iftar », zakat al-fitr. */
  suhurTitle?: (end: string) => string;
  suhurBody?: (fajr: string) => string;
  iftarTitle?: string;
  iftarBody?: string;
  zakatTitle?: string;
  zakatBody?: string;
  /** Gratitude du soir (facultatif). */
  gratTitle?: string;
  gratBody?: string;
};

/**
 * Rappels du Ramadan (facultatifs, désactivés par défaut). `isFastDay` vient du mode Ramadan (ramadan.ts).
 * `imsakMin` : marge choisie par l’utilisateur (0 par défaut, aucune marge inventée).
 */
export type FastPlan = {
  isFastDay: (day: Date) => boolean;
  suhur: boolean;
  /** Minutes avant la fin du suhur. */
  suhurLead: number;
  imsakMin: number;
  iftar: boolean;
  /** Autoriser suhur / iftar pendant les heures calmes (choix explicite). */
  quietOverride: boolean;
  /** Rappel zakat al-fitr : jour choisi (AAAA-MM-JJ), à 10:00. */
  zakatDay?: string | null;
};

export type PlannedNotif = { id: string; date: Date; title: string; body: string; url: string; kind: 'prayer' | 'before' | 'friday' | 'adhkar' | 'wird' | 'quran' | 'recap' | 'paused' | 'suhur' | 'iftar' | 'zakat' | 'gratitude'; /** true seulement à l’heure d’une prière cochée, pas pour le rappel d’avant. */ playsAdhan?: boolean };
/** Rappels placés en priorité (étape 1 du plan) : adhans + suhur / iftar du Ramadan. */
export const isPriority = (e: PlannedNotif) => e.kind === 'prayer' || e.kind === 'suhur' || e.kind === 'iftar';
type DayTimes = { key: string; time: Date }[];
export type ComputeDay = (d: Date) => DayTimes;

const MIN = 60000;
const two = (n: number) => String(n).padStart(2, '0');
const hmOf = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Événements d’un jour civil, triés. */
export function eventsForDay(day: Date, times: DayTimes, prefs: NotifPrefs, L: PlanLabels, fast?: FastPlan): PlannedNotif[] {
  const at = (k: string) => times.find((x) => x.key === k)?.time;
  const dk = dayKey(day);
  const out: PlannedNotif[] = [];
  const friday = day.getDay() === 5;
  for (const k of FARD_KEYS) {
    const t = at(k);
    if (!t || !Number.isFinite(t.getTime()) || !prefs.prayers[k]) continue;
    out.push({ id: `${dk}-${k}`, date: t, title: `${L.prayer[k]} · ${L.place}`, body: L.atTime, url: '/prayers', kind: 'prayer', playsAdhan: prefs.adhan !== false });
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
  const g = prefs.gratitude;
  const [gh, gm] = /^\d{2}:\d{2}$/.test(g?.at ?? '') ? g!.at.split(':').map(Number) : [99, 99];
  if (g?.on && L.gratTitle && gh < 24 && gm < 60) {
    out.push({ id: `${dk}-gratitude`, date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), gh, gm), title: L.gratTitle, body: L.gratBody ?? '', url: '/bien-etre?s=gratitude', kind: 'gratitude' });
  }
  if (fast && fast.isFastDay(day)) {
    if (fast.suhur && fajr && L.suhurTitle) {
      const end = new Date(fajr.getTime() - Math.max(0, fast.imsakMin) * MIN);
      out.push({ id: `${dk}-suhur`, date: new Date(end.getTime() - Math.max(0, fast.suhurLead) * MIN), title: L.suhurTitle(hmOf(end)), body: L.suhurBody?.(hmOf(fajr)) ?? L.place, url: '/ramadan?s=compte', kind: 'suhur' });
    }
    if (fast.iftar && maghrib && L.iftarTitle) {
      const adhan = out.find((e) => e.id === `${dk}-maghrib`);
      if (adhan) adhan.title = `${L.iftarTitle} · ${adhan.title}`;
      else out.push({ id: `${dk}-iftar`, date: maghrib, title: `${L.iftarTitle} · ${L.prayer.maghrib}`, body: L.iftarBody ?? L.place, url: '/ramadan?s=compte', kind: 'iftar' });
    }
  }
  if (fast?.zakatDay === dk && L.zakatTitle)
    out.push({ id: `${dk}-zakat`, date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0), title: L.zakatTitle, body: L.zakatBody ?? '', url: '/ramadan?s=zakat', kind: 'zakat' });
  return applyQuiet(out.filter((e) => Number.isFinite(e.date.getTime())), prefs.quiet, fast?.quietOverride).sort((a, b) => a.date.getTime() - b.date.getTime());
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
/**
 * Retire les rappels secondaires tombant dans les heures calmes ; les adhans (kind « prayer ») ne sont jamais retirés ici.
 * Suhur / iftar : retirés aussi, sauf si `keepFast` (autorisation explicite de l’utilisateur).
 */
export function applyQuiet(ev: PlannedNotif[], q?: QuietHours, keepFast = false): PlannedNotif[] {
  return q?.on ? ev.filter((e) => e.kind === 'prayer' || (keepFast && (e.kind === 'suhur' || e.kind === 'iftar')) || !inQuiet(e.date, q)) : ev;
}

/**
 * Mode dispense (local) : pour un jour donné, « prayers » retire les rappels liés à la prière
 * (adhan, avant l’adhan, Jumu‘a, et suhur / iftar du Ramadan) ; « all » retire aussi les autres rappels.
 * Aucune règle de fiqh ici : c’est un choix de l’utilisateur.
 */
export type PauseLevel = 'none' | 'prayers' | 'all';
export type PauseFn = (day: Date) => PauseLevel;
const PRAYER_LINKED = (e: PlannedNotif) => e.kind === 'prayer' || e.kind === 'before' || e.kind === 'suhur' || e.kind === 'iftar' || e.id.endsWith('-jumua');
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
export function buildPlan(now: Date, compute: ComputeDay, prefs: NotifPrefs, L: PlanLabels, max = 63, maxDays = 30, pause?: PauseFn, fast?: FastPlan): PlannedNotif[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const days: { day: Date; ev: PlannedNotif[] }[] = [];
  for (let i = 0; i < maxDays; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
    const ev = eventsForDay(day, compute(day), prefs, L, fast).filter((e) => e.date.getTime() > now.getTime() + 5000);
    days.push({ day, ev: applyPause(ev, pause?.(day) ?? 'none') });
  }
  const out: PlannedNotif[] = [];
  // 1. Adhans des prières obligatoires (et suhur / iftar du Ramadan) d’abord.
  let covered = -1;
  for (let i = 0; i < Math.min(PRIORITY_DAYS, days.length); i++) {
    const p = days[i].ev.filter(isPriority);
    if (out.length + p.length > max) break;
    out.push(...p);
    covered = i;
  }
  // 2. Rappels secondaires de ces mêmes jours, du plus proche au plus lointain, par jours entiers.
  let complete = true;
  for (let i = 0; i <= covered; i++) {
    const sec = days[i].ev.filter((e) => !isPriority(e));
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
export const planHash = (p: PlannedNotif[]) => p.map((e) => `${e.id}@${Math.round(e.date.getTime() / MIN)}:${e.title}${e.playsAdhan ? '#adhan' : ''}`).join('|');
