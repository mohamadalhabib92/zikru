/**
 * Panneau de lecture d’un appel. Le Coran n’est pas dans le message : les deux côtés
 * lisent le Hafs Tanzil déjà dans l’app. Un hadith collé voyage avec sa source,
 * marqué comme fourni par l’enseignant. Aucun recueil nouveau.
 */
import { fromIndex, gIndex, hizbRange, pageOfIndex, pageRange, rubLabel, rubOfIndex, TOTAL_AYAHS, TOTAL_PAGES } from '../quran-nav';
import { SURAHS } from '../surahs';

export const TEACH_TOPIC = 'zikru.teach';
export const PASTE_MAX = 4000;
export const SOURCE_MAX = 180;
/** Aucun hadith de l’app n’a de licence de redistribution écrite. La liste reste vide. */
export const LICENSED_HADITH_IDS: readonly string[] = [];

export type TeachNav = 'range' | 'page' | 'hizb';

export type QuranBoard = {
  v: 1;
  kind: 'quran';
  callId: string;
  revision: number;
  sentAt: number;
  highlight: boolean;
  nav: TeachNav;
  /** Index global du premier et du dernier verset affichés (inclus). */
  start: number;
  end: number;
  focus: number;
  page: number;
};

export type PasteBoard = {
  v: 1;
  kind: 'paste';
  callId: string;
  revision: number;
  sentAt: number;
  highlight: boolean;
  hadith: boolean;
  text: string;
  source: string;
  teacherProvided: true;
};

export type OffBoard = {
  v: 1;
  kind: 'off';
  callId: string;
  revision: number;
  sentAt: number;
};

export type TeachBoard = QuranBoard | PasteBoard | OffBoard;

export type DriveOp =
  | { type: 'surah'; surah: number; from: number; to: number }
  | { type: 'page'; page: number }
  | { type: 'hizb'; hizb: number }
  | { type: 'paste'; hadith: boolean; text: string; source: string }
  | { type: 'ayah'; dir: -1 | 1 }
  | { type: 'pageStep'; dir: -1 | 1 }
  | { type: 'highlight'; on: boolean }
  | { type: 'off' };

export type DriveResult = { ok: true; board: TeachBoard } | { ok: false; reason: 'not-teacher' | 'range' | 'edge' | 'source' | 'empty' | 'kind' };

const ZOOM = [0.85, 1, 1.25, 1.5, 2] as const;

/** Plaque opaque : le texte ne se pose jamais sur une photo de paysage. */
export function teachPlate(scheme: 'light' | 'dark') {
  return scheme === 'dark'
    ? { bg: '#141210', fg: '#F6F1E6', muted: '#C9BBA4', chip: '#2C2822', hi: '#4A3E28' }
    : { bg: '#FBF7F0', fg: '#1A1612', muted: '#5C5348', chip: '#E7E0D4', hi: '#F3E6C4' };
}

export function canHostTeaching(host: boolean, premium: boolean) {
  return host && premium;
}

/** Voir le panneau ne redemande pas Premium. Entrer dans l’appel reste décidé ailleurs. */
export function canViewTeaching() {
  return true;
}

export function licensedHadith(id: string): string | null {
  return LICENSED_HADITH_IDS.includes(id) ? id : null;
}

function base(callId: string, revision: number, sentAt: number): { v: 1; callId: string; revision: number; sentAt: number } {
  return { v: 1, callId, revision, sentAt };
}

function quran(callId: string, revision: number, nav: TeachNav, start: number, end: number, focus: number, sentAt = 0): QuranBoard {
  const page = pageOfIndex(focus);
  return { ...base(callId, revision, sentAt), kind: 'quran', highlight: true, nav, start, end, focus, page };
}

export function quranCite(board: QuranBoard): string {
  const [s1, a1] = fromIndex(board.start);
  const [s2, a2] = fromIndex(board.end);
  if (s1 === s2) return a1 === a2 ? `${s1}:${a1}` : `${s1}:${a1}–${a2}`;
  return `${s1}:${a1} – ${s2}:${a2}`;
}

export function teachChip(board: QuranBoard): { hizb: string; page: number } {
  return { hizb: rubLabel(rubOfIndex(board.focus)), page: board.page };
}

export type QuranSlice = { surah: number; from: number; to: number };

/** Découpe l’intervalle affiché par sourate, pour charger le Tanzil déjà dans l’app. */
export function quranSlices(board: QuranBoard): QuranSlice[] {
  const out: QuranSlice[] = [];
  let i = board.start;
  while (i <= board.end) {
    const [s, a] = fromIndex(i);
    const last = Math.min(board.end, gIndex(s, SURAHS[s - 1][4]));
    const [, b] = fromIndex(last);
    out.push({ surah: s, from: a, to: b });
    i = last + 1;
  }
  return out;
}

function clampIndex(i: number) {
  return Math.min(TOTAL_AYAHS - 1, Math.max(0, i));
}

export function drive(board: TeachBoard | null, callId: string, op: DriveOp, teacher: boolean, sentAt = 0): DriveResult {
  if (!teacher) return { ok: false, reason: 'not-teacher' };
  const rev = (board && board.callId === callId ? board.revision : 0) + 1;
  if (op.type === 'off') return { ok: true, board: { ...base(callId, rev, sentAt), kind: 'off' } };
  if (op.type === 'surah') {
    const meta = SURAHS[op.surah - 1];
    if (!meta || op.from < 1 || op.to < op.from || op.to > meta[4]) return { ok: false, reason: 'range' };
    return { ok: true, board: quran(callId, rev, 'range', gIndex(op.surah, op.from), gIndex(op.surah, op.to), gIndex(op.surah, op.from), sentAt) };
  }
  if (op.type === 'page') {
    if (op.page < 1 || op.page > TOTAL_PAGES) return { ok: false, reason: 'range' };
    const [a, b] = pageRange(op.page);
    return { ok: true, board: quran(callId, rev, 'page', a, b - 1, a, sentAt) };
  }
  if (op.type === 'hizb') {
    if (op.hizb < 1 || op.hizb > 60) return { ok: false, reason: 'range' };
    const [a, b] = hizbRange(op.hizb);
    return { ok: true, board: quran(callId, rev, 'hizb', a, b - 1, a, sentAt) };
  }
  if (op.type === 'paste') {
    const text = op.text.trim();
    const source = op.source.trim();
    if (!text) return { ok: false, reason: 'empty' };
    if (!source) return { ok: false, reason: 'source' };
    if (text.length > PASTE_MAX || source.length > SOURCE_MAX) return { ok: false, reason: 'range' };
    const hadith = op.hadith;
    return {
      ok: true,
      board: { ...base(callId, rev, sentAt), kind: 'paste', highlight: false, hadith, text, source, teacherProvided: true },
    };
  }
  if (!board || board.callId !== callId || board.kind !== 'quran') return { ok: false, reason: 'kind' };
  if (op.type === 'highlight') return { ok: true, board: { ...board, highlight: op.on, revision: rev, sentAt } };
  if (op.type === 'pageStep') {
    const page = board.page + op.dir;
    if (page < 1 || page > TOTAL_PAGES) return { ok: false, reason: 'edge' };
    const [a, b] = pageRange(page);
    return { ok: true, board: { ...quran(callId, rev, 'page', a, b - 1, a, sentAt), highlight: board.highlight } };
  }
  const focus = board.focus + op.dir;
  if (focus < 0 || focus >= TOTAL_AYAHS) return { ok: false, reason: 'edge' };
  let start = board.start;
  let end = board.end;
  let nav = board.nav;
  if (board.nav === 'page' || focus < start || focus > end) {
    if (board.nav === 'page') {
      const page = pageOfIndex(focus);
      const [a, b] = pageRange(page);
      start = a;
      end = b - 1;
    } else {
      const len = end - start;
      if (op.dir > 0) {
        end = focus;
        start = Math.max(0, focus - len);
      } else {
        start = focus;
        end = Math.min(TOTAL_AYAHS - 1, focus + len);
      }
    }
  }
  return { ok: true, board: { ...quran(callId, rev, nav, start, end, clampIndex(focus), sentAt), highlight: board.highlight } };
}

export function nextZoom(z: number, dir: -1 | 1): number {
  let i = 0;
  for (let k = 0; k < ZOOM.length; k++) if (Math.abs(ZOOM[k] - z) < 0.01) i = k;
  return ZOOM[Math.min(ZOOM.length - 1, Math.max(0, i + dir))];
}

export function encodeTeach(board: TeachBoard): string {
  return JSON.stringify(board);
}

function int(n: unknown, min: number, max: number) {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

export function decodeTeach(raw: string): TeachBoard | null {
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!j || typeof j !== 'object') return null;
  const o = j as TeachBoard;
  if (o.v !== 1 || typeof o.callId !== 'string' || o.callId.length < 1 || o.callId.length > 80) return null;
  if (!int(o.revision, 1, 1_000_000) || !int(o.sentAt, 0, 1e15)) return null;
  if (o.kind === 'off') return { v: 1, kind: 'off', callId: o.callId, revision: o.revision, sentAt: o.sentAt };
  if (o.kind === 'paste') {
    if (typeof o.text !== 'string' || typeof o.source !== 'string') return null;
    const text = o.text.trim();
    const source = o.source.trim();
    if (!text || text.length > PASTE_MAX || !source || source.length > SOURCE_MAX) return null;
    if (o.teacherProvided !== true) return null;
    return { v: 1, kind: 'paste', callId: o.callId, revision: o.revision, sentAt: o.sentAt, highlight: false, hadith: o.hadith === true, text, source, teacherProvided: true };
  }
  if (o.kind !== 'quran') return null;
  if (o.nav !== 'range' && o.nav !== 'page' && o.nav !== 'hizb') return null;
  if (!int(o.start, 0, TOTAL_AYAHS - 1) || !int(o.end, 0, TOTAL_AYAHS - 1) || !int(o.focus, 0, TOTAL_AYAHS - 1)) return null;
  if (o.end < o.start || o.focus < o.start || o.focus > o.end) return null;
  if (!int(o.page, 1, TOTAL_PAGES) || o.page !== pageOfIndex(o.focus)) return null;
  if (typeof o.highlight !== 'boolean') return null;
  return {
    v: 1,
    kind: 'quran',
    callId: o.callId,
    revision: o.revision,
    sentAt: o.sentAt,
    highlight: o.highlight,
    nav: o.nav,
    start: o.start,
    end: o.end,
    focus: o.focus,
    page: o.page,
  };
}

/** Une révision plus ancienne, ou un autre appel, est ignorée. */
export function acceptTeach(local: TeachBoard | null, remote: TeachBoard): TeachBoard | null {
  if (local && (remote.callId !== local.callId || remote.revision <= local.revision)) return null;
  return remote;
}

export function teachBytes(json: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(json);
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return copy;
}

export function teachText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
