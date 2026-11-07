/**
 * Une seule récitation du Coran à la fois.
 *
 * Al-Kahf (fichier sourate entière), le mushaf, le lecteur de sourate et la mémorisation
 * créent chacun un lecteur expo-audio. La pile de navigation les garde montés ensemble.
 * `interruptionMode: 'doNotMix'` ne concerne que les autres applications : dans l’app,
 * deux lecteurs jouent en même temps. Ouvrir un écran ne lance rien. Seul un départ
 * explicite prend la main et met les autres en pause.
 *
 * Les attentes (5 s méditatives, pause de mémorisation) sont annulées par une pause,
 * un arrêt, un changement de source, une prise de main ou un démontage : un minuteur
 * périmé ne relance pas l’audio et n’en superpose pas un second.
 */
import { MEDITATIVE_GAP_MS, type ReadingMode, type VersePlan } from './recitation-queue';

export type { ReadingMode };
export { MEDITATIVE_GAP_MS };

export type QuranIntent = 'idle' | 'playing' | 'user-paused' | 'yielded' | 'ended';

export type PendingAdvance = { epoch: number; next: number; same: boolean; delayMs: number };

export type QuranOwner = {
  id: string;
  generation: number;
  epoch: number;
  intent: QuranIntent;
  mode: ReadingMode;
  pending: PendingAdvance | null;
  /** Verset déjà fini : la reprise manuelle joue le suivant, pas le verset terminé. */
  resumeNext: { next: number; same: boolean } | null;
  /** La fin de ce verset a déjà été traitée (une seule pause méditative). */
  finishConsumed: boolean;
};

export type QuranSession = {
  owners: Record<string, QuranOwner>;
  activeId: string | null;
};

const fresh = (id: string, mode: ReadingMode): QuranOwner => ({
  id,
  generation: 0,
  epoch: 0,
  intent: 'idle',
  mode,
  pending: null,
  resumeNext: null,
  finishConsumed: false,
});

export function createQuranSession(): QuranSession {
  return { owners: {}, activeId: null };
}

export function mountQuranOwner(s: QuranSession, id: string, mode: ReadingMode = 'normal'): QuranSession {
  if (s.owners[id]) return s;
  return { ...s, owners: { ...s.owners, [id]: fresh(id, mode) } };
}

export function unmountQuranOwner(s: QuranSession, id: string): QuranSession {
  const o = s.owners[id];
  if (!o) return s;
  const owners = { ...s.owners };
  delete owners[id];
  return { owners, activeId: s.activeId === id ? null : s.activeId };
}

function patch(s: QuranSession, id: string, o: QuranOwner, activeId = s.activeId): QuranSession {
  return { activeId, owners: { ...s.owners, [id]: o } };
}

/** Lecteur dont la récitation est en cours (y compris l’attente avant le verset suivant). */
export function audibleOwner(s: QuranSession): string | null {
  if (!s.activeId) return null;
  const o = s.owners[s.activeId];
  return o && o.intent === 'playing' ? o.id : null;
}

export function isCurrentGeneration(s: QuranSession, id: string, generation: number): boolean {
  const o = s.owners[id];
  return !!o && o.generation === generation && o.intent === 'playing' && s.activeId === id;
}

/**
 * Départ explicite. Les autres récitations sont cédées (pause) et leurs attentes annulées.
 * Relancer le même lecteur invalide aussi son minuteur et toute génération précédente.
 */
export function requestQuranPlay(s: QuranSession, id: string): { session: QuranSession; generation: number; preempted: string[] } {
  s = mountQuranOwner(s, id, s.owners[id]?.mode ?? 'normal');
  const preempted: string[] = [];
  let owners = { ...s.owners };
  for (const oid of Object.keys(owners)) {
    if (oid === id) continue;
    const o = owners[oid];
    if (o.intent === 'playing' || o.pending || o.resumeNext) {
      owners[oid] = {
        ...o,
        intent: 'yielded',
        pending: null,
        resumeNext: o.pending ? { next: o.pending.next, same: o.pending.same } : null,
        epoch: o.epoch + 1,
        generation: o.generation + 1,
        finishConsumed: true,
      };
      preempted.push(oid);
    }
  }
  const cur = owners[id];
  const next: QuranOwner = {
    ...cur,
    intent: 'playing',
    pending: null,
    resumeNext: null,
    epoch: cur.epoch + 1,
    generation: cur.generation + 1,
    finishConsumed: false,
  };
  owners = { ...owners, [id]: next };
  return { session: { owners, activeId: id }, generation: next.generation, preempted };
}

/** Reprise. Si le verset en cours était déjà fini, `resumeNext` indique le suivant. */
export function resumeQuranPlay(s: QuranSession, id: string): {
  session: QuranSession;
  generation: number;
  preempted: string[];
  resumeNext: { next: number; same: boolean } | null;
} {
  const resumeNext = s.owners[id]?.resumeNext ?? null;
  const r = requestQuranPlay(s, id);
  return { ...r, resumeNext };
}

export function userPauseQuran(s: QuranSession, id: string): QuranSession {
  const o = s.owners[id];
  if (!o || (o.intent !== 'playing' && !o.pending)) return s;
  return patch(
    s,
    id,
    {
      ...o,
      intent: 'user-paused',
      resumeNext: o.pending ? { next: o.pending.next, same: o.pending.same } : null,
      pending: null,
      epoch: o.epoch + 1,
      generation: o.generation + 1,
      finishConsumed: true,
    },
    s.activeId === id ? null : s.activeId,
  );
}

export function userStopQuran(s: QuranSession, id: string): QuranSession {
  const o = s.owners[id];
  if (!o || (o.intent === 'idle' && !o.pending && !o.resumeNext)) return s;
  return patch(
    s,
    id,
    { ...o, intent: 'idle', pending: null, resumeNext: null, epoch: o.epoch + 1, generation: o.generation + 1, finishConsumed: true },
    s.activeId === id ? null : s.activeId,
  );
}

/** Le verset qui commence peut à nouveau signaler sa fin, une seule fois. */
export function armQuranVerse(s: QuranSession, id: string): QuranSession {
  const o = s.owners[id];
  if (!o) return s;
  return patch(s, id, { ...o, finishConsumed: false, pending: null });
}

export type VerseEffect =
  | { effect: 'ignore' }
  | { effect: 'end' }
  | { effect: 'advance-now'; next: number; same: boolean }
  | { effect: 'wait'; delayMs: number; next: number; same: boolean; epoch: number };

/** Fin de verset acceptée par le lecteur. Un second appel pour le même verset est ignoré. */
export function onQuranVerseFinished(s: QuranSession, id: string, plan: VersePlan): { session: QuranSession; decision: VerseEffect } {
  const o = s.owners[id];
  if (!o || o.intent !== 'playing' || s.activeId !== id || o.finishConsumed) return { session: s, decision: { effect: 'ignore' } };
  const base = { ...o, finishConsumed: true, resumeNext: null as QuranOwner['resumeNext'] };
  if (plan.type === 'end') {
    return {
      session: patch(s, id, { ...base, intent: 'ended', pending: null, epoch: o.epoch + 1 }, null),
      decision: { effect: 'end' },
    };
  }
  if (plan.type === 'now') {
    return { session: patch(s, id, { ...base, pending: null }), decision: { effect: 'advance-now', next: plan.next, same: plan.same } };
  }
  const epoch = o.epoch + 1;
  const pending = { epoch, next: plan.next, same: plan.same, delayMs: plan.delayMs };
  return {
    session: patch(s, id, { ...base, epoch, pending }),
    decision: { effect: 'wait', delayMs: plan.delayMs, next: plan.next, same: plan.same, epoch },
  };
}

/** Le minuteur n’agit que s’il est encore celui de la lecture en cours. */
export function fireQuranPending(s: QuranSession, id: string, epoch: number): { session: QuranSession; play: boolean; next?: number; same?: boolean } {
  const o = s.owners[id];
  if (!o || !o.pending || o.pending.epoch !== epoch) return { session: s, play: false };
  if (o.intent !== 'playing' || s.activeId !== id) return { session: patch(s, id, { ...o, pending: null }), play: false };
  const { next, same } = o.pending;
  return { session: patch(s, id, { ...o, pending: null }), play: true, next, same };
}

/**
 * Changer de mode ne relance pas le verset en cours.
 * Une attente déjà posée est réconciliée : retour au continu = enchaîner une fois ;
 * passage au méditatif = une seule attente de 5 s. L’ancien minuteur ne part plus.
 */
export function applyQuranMode(s: QuranSession, id: string, mode: ReadingMode): { session: QuranSession; decision: VerseEffect } {
  s = mountQuranOwner(s, id, mode);
  const o = s.owners[id];
  if (o.mode === mode) return { session: s, decision: { effect: 'ignore' } };
  const next = { ...o, mode };
  if (!o.pending || o.intent !== 'playing' || s.activeId !== id) {
    return { session: patch(s, id, { ...next, pending: null }), decision: { effect: 'ignore' } };
  }
  if (mode === 'normal') {
    const p = o.pending;
    return {
      session: patch(s, id, { ...next, pending: null, epoch: o.epoch + 1 }),
      decision: { effect: 'advance-now', next: p.next, same: p.same },
    };
  }
  const epoch = o.epoch + 1;
  return {
    session: patch(s, id, { ...next, epoch, pending: { ...o.pending, epoch, delayMs: MEDITATIVE_GAP_MS } }),
    decision: { effect: 'wait', delayMs: MEDITATIVE_GAP_MS, next: o.pending.next, same: o.pending.same, epoch },
  };
}

// --- session unique de l’app (les tests utilisent les fonctions pures ci-dessus) ---

let session = createQuranSession();
const preemptListeners = new Map<string, Set<() => void>>();

export function onQuranPreempted(id: string, fn: () => void): () => void {
  let set = preemptListeners.get(id);
  if (!set) preemptListeners.set(id, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}

export function quranMount(id: string, mode?: ReadingMode) {
  session = mountQuranOwner(session, id, mode ?? session.owners[id]?.mode ?? 'normal');
}

export function quranUnmount(id: string) {
  session = unmountQuranOwner(session, id);
  preemptListeners.delete(id);
}

export function quranRequestPlay(id: string): number {
  const r = requestQuranPlay(session, id);
  session = r.session;
  for (const oid of r.preempted) preemptListeners.get(oid)?.forEach((fn) => fn());
  return r.generation;
}

export function quranResume(id: string): { generation: number; resumeNext: { next: number; same: boolean } | null } {
  const r = resumeQuranPlay(session, id);
  session = r.session;
  for (const oid of r.preempted) preemptListeners.get(oid)?.forEach((fn) => fn());
  return { generation: r.generation, resumeNext: r.resumeNext };
}

export function quranUserPause(id: string) {
  session = userPauseQuran(session, id);
}

export function quranUserStop(id: string) {
  session = userStopQuran(session, id);
}

export function quranArmVerse(id: string) {
  session = armQuranVerse(session, id);
}

export function quranIsCurrent(id: string, generation: number): boolean {
  return isCurrentGeneration(session, id, generation);
}

export function quranIntent(id: string): QuranIntent | null {
  return session.owners[id]?.intent ?? null;
}

export function quranResumeNext(id: string): { next: number; same: boolean } | null {
  return session.owners[id]?.resumeNext ?? null;
}

export function quranOwnsPlayback(id: string): boolean {
  return audibleOwner(session) === id;
}

export function quranOnVerseFinished(id: string, plan: VersePlan): VerseEffect {
  const r = onQuranVerseFinished(session, id, plan);
  session = r.session;
  return r.decision;
}

export function quranFirePending(id: string, epoch: number): { play: boolean; next?: number; same?: boolean } {
  const r = fireQuranPending(session, id, epoch);
  session = r.session;
  return { play: r.play, next: r.next, same: r.same };
}

export function quranApplyMode(id: string, mode: ReadingMode): VerseEffect {
  const r = applyQuranMode(session, id, mode);
  session = r.session;
  return r.decision;
}
