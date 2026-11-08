/**
 * Respiration guidée (module pur, testé par scripts/test-bien-etre.mjs) : cohérence cardiaque (6 respirations / min)
 * et respiration carrée (4-4-4-4). Aucune allégation de santé : l’app propose un rythme, rien de plus.
 */

export type Phase = 'in' | 'holdIn' | 'out' | 'holdOut';
export type PatternId = 'coherence' | 'box';
export type Pattern = { id: PatternId; phases: { p: Phase; s: number }[] };

export const PATTERNS: Record<PatternId, Pattern> = {
  /** 5 s d’inspiration, 5 s d’expiration : 10 s par cycle, soit 6 respirations par minute. */
  coherence: { id: 'coherence', phases: [{ p: 'in', s: 5 }, { p: 'out', s: 5 }] },
  /** Respiration carrée : inspirer 4 s, retenir 4 s, expirer 4 s, retenir 4 s. */
  box: { id: 'box', phases: [{ p: 'in', s: 4 }, { p: 'holdIn', s: 4 }, { p: 'out', s: 4 }, { p: 'holdOut', s: 4 }] },
};
/** Durée par défaut (minutes) : 5 min. */
export const DEFAULT_MINUTES = 5;
/** Paliers de durée proposés, du plus court au plus long. */
export const LEVELS = [1, 3, 5, 10] as const;

export const cycleMs = (p: Pattern) => p.phases.reduce((t, x) => t + x.s, 0) * 1000;
export const breathsPerMinute = (p: Pattern) => 60000 / cycleMs(p);

/** Durée réelle d’une séance : arrondie au cycle complet supérieur (on finit toujours sur une expiration achevée). */
export function sessionMs(p: Pattern, minutes: number): number {
  const c = cycleMs(p);
  return Math.max(1, Math.ceil((Math.max(0, minutes) * 60000) / c)) * c;
}

export type BreathState = {
  phase: Phase;
  /** Index de la phase dans le cycle. */
  index: number;
  /** Cycle en cours (0, 1, 2…). */
  cycle: number;
  /** Avancement dans la phase (0..1). */
  progress: number;
  /** Remplissage (0 = poumons vides, 1 = pleins) : sert à l’animation du cercle. */
  level: number;
  /** Secondes restantes dans la phase (arrondi supérieur, pour l’affichage « 3, 2, 1 »). */
  secondsLeft: number;
  /** Séance terminée. */
  done: boolean;
  remainingMs: number;
};

/** État à l’instant t (ms écoulées depuis le début) d’une séance de `totalMs`. */
export function breathAt(p: Pattern, tMs: number, totalMs = Infinity): BreathState {
  const t = Math.max(0, tMs);
  if (t >= totalMs) {
    const last = p.phases.length - 1;
    return { phase: p.phases[last].p, index: last, cycle: Math.round(totalMs / cycleMs(p)) - 1, progress: 1, level: levelOf(p.phases[last].p, 1), secondsLeft: 0, done: true, remainingMs: 0 };
  }
  const c = cycleMs(p);
  const cycle = Math.floor(t / c);
  let r = t - cycle * c;
  let index = 0;
  while (r >= p.phases[index].s * 1000) {
    r -= p.phases[index].s * 1000;
    index++;
  }
  const ph = p.phases[index];
  const progress = r / (ph.s * 1000);
  return { phase: ph.p, index, cycle, progress, level: levelOf(ph.p, progress), secondsLeft: Math.ceil(ph.s - r / 1000), done: false, remainingMs: totalMs - t };
}

/** Courbe douce (cosinus) : départ et arrivée lents, sans à-coup. */
export const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
function levelOf(ph: Phase, x: number): number {
  if (ph === 'in') return ease(x);
  if (ph === 'out') return 1 - ease(x);
  return ph === 'holdIn' ? 1 : 0;
}

/** Changements de phase franchis entre deux instants (pour déclencher un retour haptique à chaque passage). */
export function phaseChanges(p: Pattern, fromMs: number, toMs: number, totalMs = Infinity): Phase[] {
  const out: Phase[] = [];
  if (toMs <= fromMs) return out;
  const bounds: { at: number; p: Phase }[] = [];
  const c = cycleMs(p);
  const start = Math.floor(Math.max(0, fromMs) / c) * c;
  for (let base = start; base <= toMs && base < totalMs; base += c) {
    let at = base;
    for (const ph of p.phases) {
      bounds.push({ at, p: ph.p });
      at += ph.s * 1000;
    }
  }
  for (const x of bounds) if (x.at > fromMs && x.at <= toMs && x.at < totalMs) out.push(x.p);
  return out;
}

/** Appariement facultatif d’un dhikr au souffle : un élément du catalogue sourcé par phase (ou rien). */
export type BreathPairing = { in?: string; out?: string };
/** Élément affiché pendant une phase (les rétentions restent silencieuses). */
export function pairedFor(pairing: BreathPairing | null | undefined, ph: Phase): string | undefined {
  if (!pairing) return undefined;
  return ph === 'in' ? pairing.in : ph === 'out' ? pairing.out : undefined;
}

/** Historique privé (sur l’appareil) : minutes pratiquées par motif, nombre de séances. */
export type BreathLog = { sessions: number; minutes: number; byLevel: Record<string, number> };
export const EMPTY_LOG: BreathLog = { sessions: 0, minutes: 0, byLevel: {} };
export function logSession(log: BreathLog, minutes: number): BreathLog {
  const k = String(minutes);
  return { sessions: log.sessions + 1, minutes: log.minutes + minutes, byLevel: { ...log.byLevel, [k]: (log.byLevel[k] ?? 0) + 1 } };
}
/**
 * Palier suggéré : après 3 séances complètes à un palier, on propose le suivant. Simple suggestion,
 * toujours modifiable ; jamais de score ni de comparaison.
 */
export function suggestedMinutes(log: BreathLog): number {
  let best: number = LEVELS[0];
  for (let i = 0; i < LEVELS.length; i++) {
    const done = log.byLevel[String(LEVELS[i])] ?? 0;
    if (done > 0) best = LEVELS[i];
    if (done >= 3 && i + 1 < LEVELS.length) best = LEVELS[i + 1];
  }
  return log.sessions === 0 ? DEFAULT_MINUTES : best;
}
