import type { Dict } from './i18n';
import { computeDay, prayerOptionsOf, type HighLatKey, type MethodKey, type MinuteAdjustments, type MosqueTimetable, type Place } from './prayer';
import { buildPlan, gatePlan, type NotifPrefs, type PlanGate, type PlanLabels } from './notify-plan';

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

export type PlanInput = {
  place: Place;
  method: MethodKey;
  madhab: 'shafi' | 'hanafi';
  notif: NotifPrefs;
  highLat?: HighLatKey;
  adjustments?: MinuteAdjustments | null;
  mosque?: MosqueTimetable | null;
  dispense?: { on?: boolean } | null;
};
export function planFor(now: Date, s: PlanInput, tr: Dict, gate?: PlanGate | null) {
  const suspended = gate?.suspended || s.dispense?.on === true;
  return gatePlan(buildPlan(now, (d) => computeDay(d, s.place, s.method, s.madhab, prayerOptionsOf(s)), s.notif, planLabels(tr, s.place.label)), { ...gate, suspended });
}
