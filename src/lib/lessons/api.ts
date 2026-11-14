/**
 * Lecture partagée : le serveur décide qui lit et qui écrit (RLS + fonctions).
 * Ici, seulement les appels. Le texte du Coran n’est pas envoyé.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CommunityError, frError, type ClassLesson } from '@/lib/community/api';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { L } from '@/lib/l10n';
import type { MarkKind, ReadingMark, ReadingState } from './reading';

export type ReadingRow = {
  lesson_id: string;
  surah: number;
  ayah_from: number;
  ayah_to: number;
  focus_ayah: number;
  focus_word: number | null;
  driver_id: string | null;
  revision: number;
  marks: ReadingMark[];
};

const missing = (e: { code?: string; message?: string }) =>
  e.code === '42703' || e.code === '42883' || e.code === '42P01' || e.code === 'PGRST202' || e.code === 'PGRST204' || e.code === 'PGRST205'
  || /schema cache|does not exist|could not find/i.test(e.message ?? '');

async function sb(): Promise<SupabaseClient> {
  const c = await getSupabase();
  if (!c) throw new CommunityError(supabaseConfigured ? L('Pas de connexion. Réessayez quand vous serez en ligne.') : L('Serveur non configuré.'));
  return c;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const c = await sb();
  const { data, error } = await c.rpc(fn, args);
  if (error) {
    if (missing(error)) throw new CommunityError(frError(error), 'PGRST202');
    throw new CommunityError(frError(error), error.code);
  }
  return data as T;
}

export function rowToState(row: ReadingRow, page: number): ReadingState {
  return {
    lessonId: row.lesson_id,
    surah: row.surah,
    ayahFrom: row.ayah_from,
    ayahTo: row.ayah_to,
    focusAyah: row.focus_ayah,
    focusWord: row.focus_word,
    driverId: row.driver_id,
    revision: row.revision,
    page,
    marks: row.marks ?? [],
  };
}

/** null = la migration n’est pas sur ce serveur. */
export async function sharedReadingEnabled(): Promise<boolean | null> {
  try {
    return await rpc<boolean>('shared_reading_open', {});
  } catch (e) {
    if (e instanceof CommunityError && e.code === 'PGRST202') return null;
    throw e;
  }
}

export async function getClassLesson(id: string): Promise<ClassLesson | null> {
  const c = await sb();
  const { data, error } = await c.from('class_lessons').select('id,circle_id,title,starts_at,surah,ayah_from,ayah_to,cancelled_at').eq('id', id).maybeSingle();
  if (error) {
    if (missing(error)) return null;
    throw new CommunityError(frError(error), error.code);
  }
  return data;
}

/** null = pas encore de position. */
export async function fetchReading(lessonId: string): Promise<ReadingRow | null> {
  return rpc<ReadingRow | null>('lesson_reading', { p_lesson: lessonId });
}

export const openReading = (lessonId: string, surah: number, from: number, to: number) =>
  rpc<ReadingRow>('open_lesson_reading', { p_lesson: lessonId, p_surah: surah, p_from: from, p_to: to });

export const setFocus = (lessonId: string, ayah: number, word: number | null) =>
  rpc<ReadingRow>('set_reading_focus', { p_lesson: lessonId, p_ayah: ayah, p_word: word });

export const handReading = (lessonId: string, userId: string | null) =>
  rpc<ReadingRow>('hand_reading', { p_lesson: lessonId, p_user: userId });

export const addMark = (lessonId: string, ayah: number, word: number | null, kind: MarkKind, comment: string) =>
  rpc<ReadingRow>('add_lesson_mark', { p_lesson: lessonId, p_ayah: ayah, p_word: word, p_kind: kind, p_comment: comment });

export const removeMark = (id: string) => rpc<ReadingRow>('remove_lesson_mark', { p_id: id });

/** Repli quand il n’y a pas d’appel : la base prévient, l’écran relit la position. */
export async function watchReading(lessonId: string, onChange: () => void): Promise<() => void> {
  const c = await sb();
  const ch = c
    .channel(`reading:${lessonId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_readings', filter: `lesson_id=eq.${lessonId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_marks', filter: `lesson_id=eq.${lessonId}` }, onChange)
    .subscribe();
  return () => {
    void c.removeChannel(ch);
  };
}
