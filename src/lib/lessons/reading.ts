/**
 * Position partagée d’une leçon. Aucun verset ici : les deux écrans lisent le Hafs Tanzil embarqué.
 * Ce module ne fait que la position, le curseur et les marques. Le texte n’est jamais réécrit.
 */

export const READING_TOPIC = 'zikru.reading';
export const MARK_KINDS = ['tajweed', 'comment'] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export type ReadingMark = {
  id: string;
  surah: number;
  ayah: number;
  word: number | null;
  kind: MarkKind;
  comment: string;
};

export type ReadingState = {
  lessonId: string;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  focusAyah: number;
  focusWord: number | null;
  /** null = l’enseignant conduit. */
  driverId: string | null;
  revision: number;
  /** Page du mushaf de Médine, calculée par l’écran à partir du verset. */
  page: number;
  marks: ReadingMark[];
};

export type ReadingEnvelope = {
  v: 1;
  lessonId: string;
  surah: number;
  from: number;
  to: number;
  ayah: number;
  word: number | null;
  driverId: string | null;
  revision: number;
  page: number;
  marks: ReadingMark[];
};

export type VerseLine = { ayah: number; text: string; words: string[] };

/** Découpe Tanzil « sourate|verset|texte ». Le texte du verset est recopié tel quel. */
export function passageFromTanzil(raw: string, surah: number, from: number, to: number): VerseLine[] {
  const out: VerseLine[] = [];
  for (const line of raw.split('\n')) {
    if (!line || line[0] === '#') continue;
    const i = line.indexOf('|');
    const j = line.indexOf('|', i + 1);
    if (i < 0 || j < 0) continue;
    const s = +line.slice(0, i);
    const a = +line.slice(i + 1, j);
    if (s !== surah || a < from || a > to) continue;
    const text = line.slice(j + 1);
    out.push({ ayah: a, text, words: text.split(' ') });
  }
  return out;
}

/** Le verset affiché mot à mot est le verset Tanzil : aucun mot retiré, aucun ajout. */
export function verseIntact(line: VerseLine): boolean {
  return line.words.join(' ') === line.text;
}

export function teacherDrives(state: ReadingState): boolean {
  return state.driverId === null;
}

export function canMove(state: ReadingState, userId: string, teacher: boolean): boolean {
  if (state.driverId === null) return teacher;
  return state.driverId === userId;
}

export function marksOn(state: ReadingState, ayah: number, word: number | null): ReadingMark[] {
  return state.marks.filter((m) => m.surah === state.surah && m.ayah === ayah && m.word === word);
}

type Reject = { ok: false; reason: 'not-teacher' | 'not-driver' | 'range' | 'word' | 'mark' | 'comment' };
type Applied = { ok: true; state: ReadingState };

function next(state: ReadingState, patch: Partial<ReadingState>): ReadingState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

/** Règles du curseur, miroir de ce que le serveur refuse. Le texte n’entre pas dans l’état. */
export function applyReadingOp(
  state: ReadingState,
  op:
    | { type: 'passage'; surah: number; from: number; to: number; actorTeacher: boolean; page: number }
    | { type: 'focus'; ayah: number; word: number | null; wordCount: number; actorId: string; teacher: boolean; page: number }
    | { type: 'hand'; to: string | null; actorTeacher: boolean; members: string[] }
    | { type: 'mark'; mark: ReadingMark; actorTeacher: boolean }
    | { type: 'unmark'; id: string; actorTeacher: boolean },
): Applied | Reject {
  if (op.type === 'passage') {
    if (!op.actorTeacher) return { ok: false, reason: 'not-teacher' };
    if (op.from < 1 || op.to < op.from) return { ok: false, reason: 'range' };
    return {
      ok: true,
      state: next(state, {
        surah: op.surah,
        ayahFrom: op.from,
        ayahTo: op.to,
        focusAyah: op.from,
        focusWord: null,
        driverId: null,
        page: op.page,
      }),
    };
  }
  if (op.type === 'focus') {
    if (!canMove(state, op.actorId, op.teacher)) return { ok: false, reason: 'not-driver' };
    if (op.ayah < state.ayahFrom || op.ayah > state.ayahTo) return { ok: false, reason: 'range' };
    if (op.word !== null && (op.word < 0 || op.word >= op.wordCount || op.word > 400)) return { ok: false, reason: 'word' };
    return { ok: true, state: next(state, { focusAyah: op.ayah, focusWord: op.word, page: op.page }) };
  }
  if (op.type === 'hand') {
    if (!op.actorTeacher) return { ok: false, reason: 'not-teacher' };
    if (op.to !== null && !op.members.includes(op.to)) return { ok: false, reason: 'not-teacher' };
    return { ok: true, state: next(state, { driverId: op.to }) };
  }
  if (!op.actorTeacher) return { ok: false, reason: 'not-teacher' };
  if (op.type === 'unmark') {
    return { ok: true, state: next(state, { marks: state.marks.filter((m) => m.id !== op.id) }) };
  }
  const mark = op.mark;
  if (mark.kind !== 'tajweed' && mark.kind !== 'comment') return { ok: false, reason: 'mark' };
  if (mark.ayah < state.ayahFrom || mark.ayah > state.ayahTo || mark.surah !== state.surah) return { ok: false, reason: 'range' };
  if (mark.word !== null && (mark.word < 0 || mark.word > 400)) return { ok: false, reason: 'word' };
  const comment = mark.comment.trim();
  if (comment.length > 280) return { ok: false, reason: 'comment' };
  if (mark.kind === 'comment' && comment === '') return { ok: false, reason: 'comment' };
  if (state.marks.length >= 100) return { ok: false, reason: 'mark' };
  return { ok: true, state: next(state, { marks: [...state.marks, { ...mark, comment }] }) };
}

export function encodeReading(state: ReadingState): string {
  const env: ReadingEnvelope = {
    v: 1,
    lessonId: state.lessonId,
    surah: state.surah,
    from: state.ayahFrom,
    to: state.ayahTo,
    ayah: state.focusAyah,
    word: state.focusWord,
    driverId: state.driverId,
    revision: state.revision,
    page: state.page,
    marks: state.marks,
  };
  return JSON.stringify(env);
}

function isMark(x: unknown): x is ReadingMark {
  if (!x || typeof x !== 'object') return false;
  const m = x as ReadingMark;
  return typeof m.id === 'string' && m.id.length > 0 && m.id.length <= 80
    && Number.isInteger(m.surah) && Number.isInteger(m.ayah)
    && (m.word === null || (Number.isInteger(m.word) && m.word >= 0 && m.word <= 400))
    && (m.kind === 'tajweed' || m.kind === 'comment')
    && typeof m.comment === 'string' && m.comment.length <= 280;
}

export function decodeReading(raw: string): ReadingEnvelope | null {
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!j || typeof j !== 'object') return null;
  const o = j as ReadingEnvelope;
  if (o.v !== 1 || typeof o.lessonId !== 'string' || o.lessonId.length < 8) return null;
  if (!Number.isInteger(o.revision) || o.revision < 1) return null;
  if (!Number.isInteger(o.surah) || o.surah < 1 || o.surah > 114) return null;
  if (!Number.isInteger(o.from) || !Number.isInteger(o.to) || !Number.isInteger(o.ayah)) return null;
  if (o.from < 1 || o.to < o.from || o.ayah < o.from || o.ayah > o.to) return null;
  if (o.word !== null && (!Number.isInteger(o.word) || o.word < 0 || o.word > 400)) return null;
  if (o.driverId !== null && (typeof o.driverId !== 'string' || o.driverId.length < 8)) return null;
  if (!Number.isInteger(o.page) || o.page < 1 || o.page > 604) return null;
  if (!Array.isArray(o.marks) || o.marks.length > 100 || !o.marks.every(isMark)) return null;
  return {
    v: 1,
    lessonId: o.lessonId,
    surah: o.surah,
    from: o.from,
    to: o.to,
    ayah: o.ayah,
    word: o.word,
    driverId: o.driverId,
    revision: o.revision,
    page: o.page,
    marks: o.marks.map((m) => ({ id: m.id, surah: m.surah, ayah: m.ayah, word: m.word, kind: m.kind, comment: m.comment })),
  };
}

export function stateFromEnvelope(env: ReadingEnvelope): ReadingState {
  return {
    lessonId: env.lessonId,
    surah: env.surah,
    ayahFrom: env.from,
    ayahTo: env.to,
    focusAyah: env.ayah,
    focusWord: env.word,
    driverId: env.driverId,
    revision: env.revision,
    page: env.page,
    marks: env.marks,
  };
}

/** Une révision plus ancienne, ou une autre leçon, est ignorée. */
export function acceptRemote(local: ReadingState | null, remote: ReadingEnvelope): ReadingState | null {
  if (local && (remote.lessonId !== local.lessonId || remote.revision <= local.revision)) return null;
  return stateFromEnvelope(remote);
}

export function readingBytes(json: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(json);
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return copy;
}

export function readingText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
