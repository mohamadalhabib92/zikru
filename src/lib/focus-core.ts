/**
 * Mode Focus : logique pure (aucune dépendance React, stockage ou plateforme), testée à part.
 * Le minuteur ne compte que le temps passé DANS l'app : en arrière-plan il se met en pause,
 * l'absence est notée comme interruption, et la séance reprend au retour.
 * Durée minimale : 10 minutes. Avant la fin, la sortie ne passe que par la « Sortie d'urgence ».
 */
export const FOCUS_MIN_MINUTES = 10;
export const FOCUS_MAX_MINUTES = 180;
export const FOCUS_DURATIONS = [10, 15, 20, 30] as const;
/** Durée d'appui long de la « Sortie d'urgence ». */
export const EMERGENCY_HOLD_MS = 3000;
/** Absence ignorée en deçà (bascule d'un éclair, centre de contrôle…). */
export const AWAY_MIN_MS = 1000;
/** Séance restaurée au-delà de ce délai : considérée comme abandonnée. */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
export const MAX_HISTORY = 400;
/** Paliers (en minutes restantes) annoncés au lecteur d'écran. */
export const MILESTONES_MIN = [20, 15, 10, 5, 1] as const;

export type FocusInterruption = { at: number; ms: number };
export type FocusSession = {
  id: string;
  plannedMs: number;
  startedAt: number;
  /** Temps de focus accumulé avant la reprise en cours. */
  accumulatedMs: number;
  /** Début de la reprise en cours ; null = en pause (app quittée). */
  runningSince: number | null;
  /** Moment où l'app a été quittée ; null = au premier plan. */
  awaySince: number | null;
  /** Dernier signe de vie (sert à ne pas compter le temps si l'app a été tuée). */
  seenAt: number;
  interruptions: FocusInterruption[];
  activity?: string;
};
export type FocusRecord = {
  id: string;
  day: string;
  startedAt: number;
  endedAt: number;
  plannedMin: number;
  focusedMs: number;
  interruptions: number;
  awayMs: number;
  completed: boolean;
  activity?: string;
};

export function clampMinutes(m: number): number {
  if (typeof m !== 'number' || !Number.isFinite(m)) return FOCUS_MIN_MINUTES;
  return Math.max(FOCUS_MIN_MINUTES, Math.min(FOCUS_MAX_MINUTES, Math.round(m)));
}

export function startFocus(minutes: number, now: number, activity?: string): FocusSession {
  return {
    id: `f${now.toString(36)}`,
    plannedMs: clampMinutes(minutes) * 60_000,
    startedAt: now,
    accumulatedMs: 0,
    runningSince: now,
    awaySince: null,
    seenAt: now,
    interruptions: [],
    ...(activity ? { activity } : null),
  };
}

export function focusedMs(s: FocusSession, now: number): number {
  const run = s.runningSince != null ? Math.max(0, now - s.runningSince) : 0;
  return Math.min(s.plannedMs, s.accumulatedMs + run);
}
export const remainingMs = (s: FocusSession, now: number) => Math.max(0, s.plannedMs - focusedMs(s, now));
export const progressOf = (s: FocusSession, now: number) => (s.plannedMs > 0 ? focusedMs(s, now) / s.plannedMs : 1);
export const isComplete = (s: FocusSession, now: number) => focusedMs(s, now) >= s.plannedMs;
/** Sortie libre : seulement une fois la durée choisie (≥ 10 min) entièrement passée dans l'app. */
export const canLeaveFreely = isComplete;
export const isPaused = (s: FocusSession) => s.runningSince == null;

/** L'app passe en arrière-plan : le minuteur s'arrête, l'absence commence. */
export function pauseFocus(s: FocusSession, now: number): FocusSession {
  if (s.runningSince == null) return s;
  const at = Math.max(s.runningSince, now);
  return { ...s, accumulatedMs: focusedMs(s, at), runningSince: null, awaySince: at, seenAt: at };
}

/** Retour dans l'app : l'absence est notée (si elle compte) et le minuteur reprend. */
export function resumeFocus(s: FocusSession, now: number): { session: FocusSession; awayMs: number } {
  if (s.runningSince != null) return { session: { ...s, seenAt: now }, awayMs: 0 };
  const since = s.awaySince ?? now;
  const awayMs = Math.max(0, now - since);
  const counts = awayMs >= AWAY_MIN_MS;
  return {
    session: {
      ...s,
      runningSince: now,
      awaySince: null,
      seenAt: now,
      interruptions: counts ? [...s.interruptions, { at: since, ms: awayMs }] : s.interruptions,
    },
    awayMs: counts ? awayMs : 0,
  };
}

export const heartbeat = (s: FocusSession, now: number): FocusSession => ({ ...s, seenAt: Math.max(s.seenAt, now) });

/**
 * Séance retrouvée au relancement de l'app. Si l'app a été fermée sans passer par l'arrière-plan,
 * le temps après le dernier signe de vie n'est pas compté (il devient une absence).
 */
export function restoreFocus(raw: unknown, now: number): { session: FocusSession | null; awayMs: number; stale: FocusSession | null } {
  const s = sanitize(raw);
  if (!s) return { session: null, awayMs: 0, stale: null };
  if (now - Math.max(s.seenAt, s.awaySince ?? 0) > STALE_AFTER_MS) return { session: null, awayMs: 0, stale: s };
  let x = s;
  if (x.runningSince != null) x = pauseFocus(x, Math.min(now, Math.max(x.runningSince, x.seenAt)));
  const r = resumeFocus(x, now);
  return { session: r.session, awayMs: r.awayMs, stale: null };
}

function sanitize(raw: unknown): FocusSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<FocusSession>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (typeof o.id !== 'string' || !num(o.plannedMs) || !num(o.startedAt) || !num(o.accumulatedMs)) return null;
  // Une séance stockée ne peut pas descendre sous le minimum (fichier modifié, ancienne version…).
  const plannedMs = Math.max(FOCUS_MIN_MINUTES * 60_000, o.plannedMs as number);
  return {
    id: o.id,
    plannedMs,
    startedAt: o.startedAt as number,
    accumulatedMs: Math.max(0, o.accumulatedMs as number),
    runningSince: num(o.runningSince) ? (o.runningSince as number) : null,
    awaySince: num(o.awaySince) ? (o.awaySince as number) : null,
    seenAt: num(o.seenAt) ? (o.seenAt as number) : (o.startedAt as number),
    interruptions: Array.isArray(o.interruptions) ? o.interruptions.filter((i) => i && num(i.at) && num(i.ms)) : [],
    ...(typeof o.activity === 'string' ? { activity: o.activity } : null),
  };
}

export function finishFocus(s: FocusSession, now: number, completed: boolean): FocusRecord {
  return {
    id: s.id,
    day: dayKey(s.startedAt),
    startedAt: s.startedAt,
    endedAt: now,
    plannedMin: Math.round(s.plannedMs / 60_000),
    focusedMs: focusedMs(s, now),
    interruptions: s.interruptions.length,
    awayMs: s.interruptions.reduce((a, i) => a + i.ms, 0),
    completed: completed && isComplete(s, now),
    ...(s.activity ? { activity: s.activity } : null),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Jour local AAAA-MM-JJ. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
}

/** Ajoute une séance en tête (sans doublon d'id), historique borné. */
export function addRecord(history: FocusRecord[], r: FocusRecord, cap = MAX_HISTORY): FocusRecord[] {
  return [r, ...history.filter((h) => h.id !== r.id)].slice(0, cap);
}

/** Série : jours consécutifs avec au moins une séance menée à terme, jusqu'à aujourd'hui (ou hier). */
export function focusStreak(history: FocusRecord[], today: string): number {
  const days = new Set(history.filter((h) => h.completed).map((h) => h.day));
  let d = days.has(today) ? today : prevDay(today);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = prevDay(d);
  }
  return n;
}

export function focusTotals(history: FocusRecord[]): { sessions: number; minutes: number } {
  const done = history.filter((h) => h.completed);
  return { sessions: done.length, minutes: Math.round(done.reduce((a, h) => a + h.focusedMs, 0) / 60_000) };
}

/** « 14:05 » (secondes arrondies au supérieur : 0:00 n'apparaît qu'à la toute fin). */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** Minutes restantes affichées (arrondi supérieur). */
export const minutesLeft = (ms: number) => Math.ceil(Math.max(0, ms) / 60_000);

/** Palier franchi entre deux lectures du minuteur (pour une annonce discrète), sinon null. */
export function crossedMilestone(prevRemainingMs: number, nextRemainingMs: number): number | null {
  for (const m of MILESTONES_MIN) {
    const edge = m * 60_000;
    if (prevRemainingMs > edge && nextRemainingMs <= edge) return m;
  }
  return null;
}
