/**
 * Appels de groupe (v1) : accès serveur. Les appels ne dépendent de rien d'autre et rien ne dépend d'eux :
 * toute erreur se traduit par « Bientôt disponible » ou un message, jamais par un plantage d'écran.
 */
import { getSupabase } from '../supabase';
import type { CallRights, CallScope } from './core';

const MISSING = ['PGRST202', 'PGRST205', '42883', '42P01', '42703'];
const isMissing = (e: { code?: string | null; message?: string | null } | null | undefined) =>
  !!e && ((!!e.code && MISSING.includes(e.code)) || /could not find the (function|table)|does not exist/i.test(e.message ?? ''));

export class CallError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

/** Droits d'appel ; { missing: true } si la migration « appels » n'est pas encore appliquée (kill-switch naturel). */
export async function callRights(scope: CallScope, id: string): Promise<{ rights: CallRights | null; missing?: boolean; offline?: boolean }> {
  const c = await getSupabase();
  if (!c) return { rights: null, missing: true };
  try {
    const { data, error } = await c.rpc('call_rights', { p_scope: scope, p_scope_id: id });
    if (error) return isMissing(error) ? { rights: null, missing: true } : { rights: null, offline: /fetch|network/i.test(error.message ?? '') };
    return { rights: (data ?? null) as CallRights | null };
  } catch {
    return { rights: null, offline: true };
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const c = await getSupabase();
  if (!c) throw new CallError('soon');
  const { data, error } = await c.functions.invoke('call-token', { body });
  if (!error) return data as T;
  const ctx = (error as { context?: { status?: number; json?: () => Promise<{ error?: string }> } }).context;
  if (ctx && typeof ctx.json === 'function') {
    const out = await ctx.json().catch(() => ({}) as { error?: string });
    if (ctx.status === 404) throw new CallError('soon'); // fonction pas encore déployée
    throw new CallError(out.error || 'livekit');
  }
  const name = (error as { name?: string }).name;
  if (name === 'FunctionsFetchError') throw new CallError('offline');
  throw new CallError('livekit');
}

export type JoinInfo = { token: string; url: string; room: string; identity: string; name: string; video: boolean; admin: boolean };
export const joinCall = (scope: CallScope, id: string, video: boolean) => invoke<JoinInfo>({ action: 'join', scope, id, video });
export const callStatus = (scope: CallScope, id: string) => invoke<{ active: boolean; count: number }>({ action: 'status', scope, id });
export const moderateCall = (scope: CallScope, id: string, action: 'mute' | 'remove', target: string) => invoke<{ ok: true }>({ action, scope, id, target });

/** Consentements vidéo par enfant (parents seulement, RLS). Colonne absente → null (appels pas encore ouverts). */
export async function videoConsents(familyId: string): Promise<Record<string, boolean> | null> {
  const c = await getSupabase();
  if (!c) return null;
  const { data, error } = await c.from('parental_controls').select('child_member_id,allow_video_calls').eq('family_id', familyId);
  if (error) return null;
  return Object.fromEntries(((data ?? []) as { child_member_id: string; allow_video_calls: boolean }[]).map((r) => [r.child_member_id, !!r.allow_video_calls]));
}
export async function setVideoConsent(familyId: string, childMemberId: string, allow: boolean): Promise<void> {
  const c = await getSupabase();
  if (!c) throw new CallError('offline');
  const { error } = await c.from('parental_controls').upsert({ child_member_id: childMemberId, family_id: familyId, allow_video_calls: allow }, { onConflict: 'child_member_id' });
  if (error) throw new CallError(isMissing(error) ? 'soon' : 'forbidden');
}
