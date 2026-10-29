/**
 * Zikru P1 — un groupe de zikr : membres, rôles, invitations, confidentialité, séances programmées.
 * BROUILLON, non branché. Emplacement prévu : src/lib/groups/useGroup.ts.
 * Toute règle d'accès est appliquée par le serveur (RLS + RPC) ; ce hook ne fait qu'afficher et appeler.
 */
import { useCallback, useEffect, useState } from 'react';
import { PWA_URL } from '../backend';
import { supabase } from '../supabase';
import { limitErrorFrom, limitMessage, type LimitError } from '../entitlements/entitlements';

export type GroupRole = 'founder' | 'moderator' | 'member';
export type SharingMode = 'nothing' | 'participation' | 'counter';
export type GroupMember = { user_id: string; display_name: string; role: GroupRole; joined_at: string };
export type GroupInvite = { id: string; role: 'member' | 'moderator'; max_uses: number; uses: number; expires_at: string; revoked_at: string | null };
export type PlannedSession = {
  id: string; title: string; formula: string | null; goal_id: string | null;
  starts_at: string; duration_minutes: number; recurrence: 'none' | 'daily' | 'weekly'; tz: string;
};
/** max_members : réduction facultative choisie par le fondateur (null = le plan du propriétaire décide). */
export type Group = { id: string; name: string; description: string | null; rules: string | null; max_members: number | null };
/** Capacité effective calculée par le serveur (plan du propriétaire). Jamais une constante côté client. */
export type GroupCapacity = { limit: number; members: number; full: boolean; over_limit: boolean };
/** Jeton en clair : montré UNE seule fois, à la création (le serveur n'en garde que le SHA-256). */
export type NewInvite = { inviteId: string; token: string; url: string; deepLink: string; expiresAt: string };

/** Lien partageable / QR code. Le jeton est dans le fragment (#) : il n'apparaît pas dans les logs serveur. */
export function inviteUrl(token: string): string {
  return `${PWA_URL}join#t=${encodeURIComponent(token)}`;
}
/** Extrait le jeton d'un lien collé, d'un QR code ou d'un deep link zikru://join?t=… */
export function parseInvite(input: string): string | null {
  const m = /[#?&]t=([A-Za-z0-9_-]{32})(?![A-Za-z0-9_-])/.exec(input) ?? /^\s*([A-Za-z0-9_-]{32})\s*$/.exec(input);
  return m ? m[1] : null;
}

function need() {
  if (!supabase) throw new Error('Connexion au serveur non configurée');
  return supabase;
}
/** Erreur serveur avec son SQLSTATE (ZKG01 = groupe complet) : l'interface teste le code, pas le texte. */
export class GroupError extends Error {
  constructor(message: string, readonly code: string | undefined, readonly limit: LimitError | null) { super(message); }
}
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await need().rpc(fn, args);
  if (error) {
    const limit = limitErrorFrom(error);
    throw new GroupError(limit ? limitMessage(limit) : error.message, error.code, limit); // messages déjà en français
  }
  return data as T;
}

/** Aperçu avant d'accepter (nom, nombre de membres, règlement). */
export const previewInvite = (token: string) =>
  rpc<{ valid: boolean; circle_id?: string; name?: string; rules?: string | null; members?: number; max_members?: number; full?: boolean; already_member?: boolean }>(
    'preview_group_invite', { p_token: token });
export const joinGroup = (token: string, displayName: string, acceptRules: boolean) =>
  rpc<{ circle_id: string; role: GroupRole }>('join_group', { p_token: token, p_display_name: displayName, p_accept_rules: acceptRules });

export function useGroup(circleId: string | null, myUserId: string | null) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [sessions, setSessions] = useState<PlannedSession[]>([]);
  const [sharing, setSharingState] = useState<SharingMode>('participation');
  const [capacity, setCapacity] = useState<GroupCapacity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myRole: GroupRole | null = members.find((m) => m.user_id === myUserId)?.role ?? null;
  const canModerate = myRole === 'founder' || myRole === 'moderator';

  const reload = useCallback(async () => {
    if (!circleId || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      const sb = supabase;
      const [g, m, sp, ps, inv, cap] = await Promise.all([
        sb.from('circles').select('id,name,description,rules,max_members').eq('id', circleId).single(),
        sb.from('circle_members').select('user_id,display_name,role,joined_at').eq('circle_id', circleId).order('joined_at'),
        sb.from('sharing_preferences').select('mode').eq('circle_id', circleId).maybeSingle(),
        sb.from('group_planned_sessions').select('id,title,formula,goal_id,starts_at,duration_minutes,recurrence,tz')
          .eq('circle_id', circleId).order('starts_at'),
        // RLS : liste vide pour un simple membre ; le hash du jeton n'est jamais lisible.
        sb.from('group_invites').select('id,role,max_uses,uses,expires_at,revoked_at').eq('circle_id', circleId)
          .is('revoked_at', null).gt('expires_at', new Date().toISOString()),
        sb.rpc('group_capacity', { p_circle: circleId }),
      ]);
      const err = g.error ?? m.error ?? sp.error ?? ps.error ?? inv.error ?? cap.error;
      if (err) throw new Error(err.message);
      setGroup(g.data as Group);
      setMembers((m.data ?? []) as GroupMember[]);
      setSharingState(((sp.data as { mode: SharingMode } | null)?.mode) ?? 'participation');
      setSessions((ps.data ?? []) as PlannedSession[]);
      setInvites((inv.data ?? []) as GroupInvite[]);
      setCapacity((cap.data ?? null) as GroupCapacity | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async <T,>(p: Promise<T>): Promise<T> => {
      try {
        const r = await p;
        await reload();
        return r;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
    [reload],
  );

  return {
    group, members, invites, sessions, sharing, myRole, canModerate, loading, error, reload,
    /** « 3 / 4 » ; capacity.full → masquer « Inviter » (le serveur refuse de toute façon avec ZKG01). */
    capacity,
    /** Crée une invitation (1 h à 7 jours, 1 à 200 utilisations). Afficher le lien/QR puis l'oublier. */
    createInvite: async (opts: { role?: 'member' | 'moderator'; maxUses?: number; hours?: number } = {}): Promise<NewInvite> => {
      const rows = await run(rpc<{ invite_id: string; token: string; expires_at: string }[]>('create_group_invite', {
        p_circle: circleId, p_role: opts.role ?? 'member', p_max_uses: opts.maxUses ?? 10, p_hours: opts.hours ?? 48,
      }));
      const r = rows[0];
      return { inviteId: r.invite_id, token: r.token, url: inviteUrl(r.token), deepLink: `zikru://join?t=${r.token}`, expiresAt: r.expires_at };
    },
    revokeInvite: (id: string) => run(rpc<void>('revoke_group_invite', { p_invite: id })),
    setSharing: (mode: SharingMode) => run(rpc<void>('set_group_sharing', { p_circle: circleId, p_mode: mode })),
    setRole: (userId: string, role: 'moderator' | 'member') =>
      run(rpc<void>('set_circle_role', { p_circle: circleId, p_user: userId, p_role: role })),
    removeMember: (userId: string) => run(rpc<void>('remove_group_member', { p_circle: circleId, p_user: userId })),
    leave: () => run(rpc<void>('leave_group', { p_circle: circleId })),
    planSession: (s: Omit<PlannedSession, 'id'>) =>
      run((async () => {
        const { error: e } = await need().from('group_planned_sessions').insert({ ...s, circle_id: circleId, created_by: myUserId });
        if (e) throw new Error(e.message);
      })()),
  };
}
