import { useMemo } from 'react';
import { hijriCalendar } from './hijri';
import type { FastPlan } from './notify-plan';
import { confirmStart, dayKey, DEFAULT_RAMADAN, fastDayPredicate, normalizeRamadan, ramadanStatus, type RamadanPrefs, type RamadanStatus } from './ramadan';
import { useSettings } from './settings';
import { shared, useShared } from './shared-state';

/** Préférences et suivis du Ramadan : stockage local uniquement (jamais synchronisé, jamais envoyé). */
export const ramadanStore = shared<RamadanPrefs>('ramadan', DEFAULT_RAMADAN, normalizeRamadan);

/** Rappels du Ramadan pour le planificateur (undefined si rien n’est activé). */
export function fastPlanOf(p: RamadanPrefs, st: RamadanStatus): FastPlan | undefined {
  if (!p.notif.suhur && !p.notif.iftar && !(p.zakat.on && p.zakat.date && !p.zakat.paid)) return undefined;
  return {
    isFastDay: fastDayPredicate(st, p),
    suhur: p.notif.suhur,
    suhurLead: p.notif.suhurLead,
    imsakMin: p.imsakMin,
    iftar: p.notif.iftar,
    quietOverride: p.notif.quietOverride,
    zakatDay: p.zakat.on && !p.zakat.paid ? p.zakat.date : null,
  };
}

/** État du Ramadan (source hégirienne unique : calendrier choisi + décalage des Réglages). */
export function useRamadan() {
  const { s, set } = useSettings();
  const [prefs, setPrefs, ready] = useShared(ramadanStore);
  const today = dayKey(new Date());
  const cal = hijriCalendar();
  const st = useMemo(() => ramadanStatus(new Date(`${today}T12:00:00`), s.hijriOffset, prefs, cal), [today, s.hijriOffset, cal, prefs]);
  const fast = useMemo(() => fastPlanOf(prefs, st), [prefs, st]);
  /** Confirme le 1er jour localement ; règle le décalage hégirien de toute l’app si possible (−2…+2). */
  const confirm = (start: string): boolean => {
    const r = confirmStart(prefs, s.hijriOffset, st.year, start, cal);
    setPrefs(r.prefs);
    if (r.offset !== s.hijriOffset) set({ hijriOffset: r.offset });
    return r.inRange;
  };
  return { prefs, setPrefs, st, ready, fast, confirm, today };
}
