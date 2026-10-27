/** Logique pure du compteur de tasbih (testée par scripts/test-ble.mjs). */
export type ClickSource = 'manuel' | 'bluetooth' | 'clavier';
export type TasbihSession = { id: string; dhikrId: string; count: number; target: number; at: string; source?: 'manuel' | 'bluetooth' | 'mixte'; deviceCount?: number };
export type Tasbih = { count: number; target: number; dhikrId: string; total: number; sessions: TasbihSession[]; deviceCount?: number };

/** Ajoute n appuis ; indique si un cycle (33/99/100…) vient d'être complété. */
export function applyClicks(t: Tasbih, n: number, source: ClickSource): { next: Tasbih; cycleCompleted: boolean; cycles: number } {
  if (n <= 0) return { next: t, cycleCompleted: false, cycles: 0 };
  const count = t.count + n;
  const cycles = t.target > 0 ? Math.floor(count / t.target) - Math.floor(t.count / t.target) : 0;
  const dev = (t.deviceCount ?? 0) + (source === 'manuel' ? 0 : n);
  return { next: { ...t, count, total: t.total + n, deviceCount: dev }, cycleCompleted: cycles > 0, cycles };
}

/** Clôt la session courante dans l'historique (source manuelle, appareil ou mixte). */
export function closeSession(t: Tasbih, id: string, at: string): Tasbih {
  if (t.count === 0) return t;
  const dev = Math.min(t.deviceCount ?? 0, t.count);
  const source: TasbihSession['source'] = dev === 0 ? 'manuel' : dev >= t.count ? 'bluetooth' : 'mixte';
  const s: TasbihSession = { id, dhikrId: t.dhikrId, count: t.count, target: t.target, at, source, deviceCount: dev };
  return { ...t, count: 0, deviceCount: 0, sessions: [s, ...t.sessions].slice(0, 200) };
}
