/**
 * Haylala du vendredi — disponibilité selon l’heure locale de l’appareil
 * et les horaires de prière déjà calculés par l’app (Asr, Maghrib).
 * Aucune dépendance : testé par scripts/test-haylala.mjs.
 */

export type HaylalaPhase = 'before-asr' | 'open' | 'after-maghrib' | 'times-unknown';

export type HaylalaWindow =
  | { shown: false; reason: 'not-friday' }
  | { shown: true; phase: HaylalaPhase; opensAt: Date | null; closesAt: Date | null };

/** Vendredi dans le fuseau local de l’objet Date (heure de l’appareil). */
export function isLocalFriday(now: Date): boolean {
  return now.getDay() === 5;
}

/**
 * Visible seulement le vendredi local.
 * Fenêtre de récitation : à partir de l’Asr (inclus) et avant le Maghrib (exclu).
 * Horaires inutilisables (absents, ou Maghrib non postérieur à l’Asr) : le vendredi
 * reste indiqué, sans déclarer la fenêtre ouverte.
 */
export function haylalaWindow(now: Date, asr: Date | null, maghrib: Date | null): HaylalaWindow {
  if (!isLocalFriday(now)) return { shown: false, reason: 'not-friday' };
  if (!asr || !maghrib || !(maghrib.getTime() > asr.getTime())) {
    return { shown: true, phase: 'times-unknown', opensAt: asr, closesAt: maghrib };
  }
  const t = now.getTime();
  if (t < asr.getTime()) return { shown: true, phase: 'before-asr', opensAt: asr, closesAt: maghrib };
  if (t >= maghrib.getTime()) return { shown: true, phase: 'after-maghrib', opensAt: asr, closesAt: maghrib };
  return { shown: true, phase: 'open', opensAt: asr, closesAt: maghrib };
}

/** Le compteur guidé ne démarre que dans la fenêtre Asr–Maghrib. */
export function haylalaCountable(w: HaylalaWindow): boolean {
  return w.shown && w.phase === 'open';
}
