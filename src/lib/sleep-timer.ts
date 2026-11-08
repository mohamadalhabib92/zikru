/**
 * Minuterie de sommeil de la récitation (module pur, testé par scripts/test-quran-pass3.mjs) :
 * arrêt après N minutes, ou à la fin de la sourate en cours.
 */
export type Sleep = { kind: 'off' } | { kind: 'at'; until: number; min: number } | { kind: 'surah'; s: number };
export const SLEEP_OFF: Sleep = { kind: 'off' };
export const SLEEP_MINUTES = [5, 10, 15, 30, 45, 60] as const;

/** Arme la minuterie : minutes (> 0), « fin de sourate » (sourate en cours), ou arrêt. */
export function armSleep(choice: number | 'surah' | 'off', now: number, curSurah: number | null): Sleep {
  if (choice === 'off') return SLEEP_OFF;
  if (choice === 'surah') return curSurah ? { kind: 'surah', s: curSurah } : SLEEP_OFF;
  const min = Math.round(choice);
  return min > 0 ? { kind: 'at', until: now + min * 60000, min } : SLEEP_OFF;
}

/**
 * Faut-il mettre la récitation en pause maintenant ?
 * - minutes : l’heure est passée ;
 * - fin de sourate : le verset en cours appartient à une autre sourate (la lecture continue est passée à la suivante).
 */
export function sleepDue(sl: Sleep, now: number, cur: { s: number } | null): boolean {
  if (sl.kind === 'at') return now >= sl.until;
  if (sl.kind === 'surah') return !!cur && cur.s !== sl.s;
  return false;
}

/** Temps restant (ms) d’une minuterie en minutes, sinon null. */
export const sleepLeft = (sl: Sleep, now: number) => (sl.kind === 'at' ? Math.max(0, sl.until - now) : null);

/** « m:ss » (ou « h:mm:ss »). */
export function fmtClock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
