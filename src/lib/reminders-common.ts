import type { Dict } from './i18n';
import { computeDay, type MethodKey, type Place, type PrayerOpts } from './prayer';
import { buildPlan, type NotifPrefs, type PauseFn, type PlanLabels } from './notify-plan';

export function planLabels(tr: Dict, place: string): PlanLabels {
  return {
    prayer: { fajr: tr.fajr, dhuhr: tr.dhuhr, asr: tr.asr, maghrib: tr.maghrib, isha: tr.isha },
    place,
    atTime: tr.notif_at,
    inMin: (n) => tr.notif_in.replace('{n}', String(n)),
    kahfTitle: tr.kahf_t,
    kahfBody: tr.kahf_b,
    jumuaTitle: tr.jumua_t,
    jumuaBody: tr.jumua_b,
    morningTitle: tr.am_t,
    eveningTitle: tr.pm_t,
    adhkarBody: tr.adhkar_b,
    wirdMorning: tr.wird_am,
    wirdEvening: tr.wird_pm,
    wazifa: tr.wazifa_t,
    hailala: tr.hailala_t,
    wirdBody: tr.wird_b,
    quranTitle: tr.quran_rem_t,
    quranBody: tr.quran_rem_b,
    pausedTitle: tr.paused_t,
    pausedBody: tr.paused_b,
  };
}

export type PlanInput = { place: Place; method: MethodKey; madhab: 'shafi' | 'hanafi'; notif: NotifPrefs; prayer?: PrayerOpts };
/** `pause` : mode dispense (local) — retire les rappels liés à la prière les jours concernés. */
export function planFor(now: Date, s: PlanInput, tr: Dict, pause?: PauseFn) {
  return buildPlan(now, (d) => computeDay(d, s.place, s.method, s.madhab, s.prayer), s.notif, planLabels(tr, s.place.label), 63, 30, pause);
}
