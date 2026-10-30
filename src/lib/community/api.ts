/**
 * Accès aux communautés (niveau 1 Famille / Usra, niveau 2 Proches / Ahbab).
 * Toute la sécurité est côté base (RLS + fonctions privées) ; ce module ne fait
 * qu'appeler les tables / RPC autorisées pour l'utilisateur connecté.
 * Niveaux futurs (Locale, Régionale, Oumma) : ajouter un ScopeType ici.
 */
import { L } from '../l10n';
import { loadJSON, saveJSON } from '../storage';
import { supabase } from '../supabase';

export type ScopeType = 'family' | 'circle';
export type FamilyRole = 'parent' | 'adult' | 'child' | 'guest';
export type CircleRole = 'founder' | 'moderator' | 'member';
export type SharingMode = 'nothing' | 'participation' | 'counter';

export type Family = { id: string; name: string; wird: string | null; created_at: string };
export type FamilyMember = { id: string; family_id: string; user_id: string | null; display_name: string; role: FamilyRole; managed_by: string | null };
export type Circle = { id: string; name: string; description: string | null; rules: string | null; max_members: number | null; created_at: string };
export type CircleMember = { circle_id: string; user_id: string; display_name: string; role: CircleRole; rules_accepted_at: string | null };
export type Goal = {
  id: string;
  scope_type: ScopeType;
  family_id: string | null;
  circle_id: string | null;
  title: string;
  formula: string | null;
  target: number;
  status: 'active' | 'done' | 'archived';
  ends_on: string | null;
  created_at: string;
};
export type GoalProgress = {
  goal_id: string;
  title: string;
  target: number;
  total: number;
  status: string;
  members: { member_id?: string; user_id?: string; name: string; role: string; participated: boolean; count: number | null }[];
};
export type ParentalControl = { child_member_id: string; family_id: string; daily_minutes_limit: number | null; messaging: 'none' | 'parents' | 'family'; content_level: 'enfant' | 'ado' };
export type CalendarEvent = { id: string; family_id: string; title: string; kind: string; starts_at: string; all_day: boolean; notes: string | null };
export type Encouragement = { id: string; scope_type: ScopeType; family_id: string | null; circle_id: string | null; sender_id: string; recipient_id: string; kind: string; body: string; created_at: string; read_at: string | null };
export type ZikrSession = { id: string; scope_type: ScopeType; family_id: string | null; circle_id: string | null; title: string; formula: string | null; target: number | null; status: 'live' | 'ended'; started_by: string | null; started_at: string };
export type SessionCount = { session_id: string; user_id: string; display_name: string; count: number };
export type InvitePreview = { valid: boolean; scope_type?: ScopeType; name?: string; role?: string; rules?: string | null; members?: number; max_members?: number | null; full?: boolean; expires_at?: string; reason?: string };
export type GroupCapacity = { limit: number; members: number; full: boolean; over_limit: boolean };
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'self_harm' | 'impersonation' | 'child_safety' | 'other';
export type ReportTarget = 'message' | 'member' | 'circle' | 'session';
export type Block = { blocked_id: string; blocked_name: string; created_at: string };

/** Erreur déjà traduite pour l'affichage ; `code` = SQLSTATE serveur (ZKG01 groupe complet, ZKR01 débit, ZKF01 filtre…). */
export class CommunityError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function sb() {
  if (!supabase) throw new CommunityError(L('Serveur non configuré.'));
  return supabase;
}

type PgError = { message?: string; code?: string; details?: string | null };
const detailOf = (e: PgError): Record<string, unknown> => {
  try {
    return e.details ? (JSON.parse(e.details) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const waitText = (s: number) => (s >= 3600 ? L('{n} h', { n: Math.ceil(s / 3600) }) : s >= 60 ? L('{n} min', { n: Math.ceil(s / 60) }) : L('{n} s', { n: Math.max(1, Math.ceil(s)) }));

/** Message lisible (fr/en/ar) pour une erreur serveur : d'après le code SQLSTATE, pas d'après le texte. */
export function frError(e: unknown): string {
  if (e instanceof CommunityError) return e.message;
  const pe = (e ?? {}) as PgError;
  const m = pe.message ?? String(e);
  const d = detailOf(pe);
  switch (pe.code) {
    case 'ZKG01':
      return L('Ce groupe est complet ({n} personnes maximum, créateur inclus).', { n: Number(d.limit) || 4 });
    case 'ZKG02':
      return L('Vous avez atteint la limite de {n} groupes créés.', { n: Number(d.limit) || 0 });
    case 'ZKR01':
      return L('Trop de tentatives. Réessayez dans {t}.', { t: waitText(Number(d.retry_after_s) || 60) });
    case 'ZKF01':
      return L(m);
    case 'ZKN01':
      return L('Ce nom est déjà utilisé dans ce cercle');
  }
  if (/network|fetch|Failed to fetch/i.test(m)) return L('Pas de connexion. Réessayez quand vous serez en ligne.');
  if (/row-level security|permission denied/i.test(m)) return L('Action non autorisée pour votre rôle.');
  if (/expir/i.test(m)) return L('Cette invitation a expiré.');
  if (/^invalid$|invalide/i.test(m)) return L('Code invalide.');
  return m.length < 160 ? L(m) : L('Une erreur est survenue.');
}

async function q<T>(p: PromiseLike<{ data: T | null; error: PgError | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new CommunityError(frError(error), error.code);
  return data as T;
}

const scopeCol = (s: ScopeType) => (s === 'family' ? 'family_id' : 'circle_id');

// ---------- Lieux ----------
export const listFamilies = () => q<Family[]>(sb().from('families').select('id,name,wird,created_at').order('created_at'));
export const listCircles = () => q<Circle[]>(sb().from('circles').select('id,name,description,rules,max_members,created_at').order('created_at'));
export const getFamily = (id: string) => q<Family>(sb().from('families').select('id,name,wird,created_at').eq('id', id).single());
export const getCircle = (id: string) => q<Circle>(sb().from('circles').select('id,name,description,rules,max_members,created_at').eq('id', id).single());
export const familyMembers = (id: string) =>
  q<FamilyMember[]>(sb().from('family_members').select('id,family_id,user_id,display_name,role,managed_by').eq('family_id', id).order('joined_at'));
export const circleMembers = (id: string) =>
  q<CircleMember[]>(sb().from('circle_members').select('circle_id,user_id,display_name,role,rules_accepted_at').eq('circle_id', id).order('joined_at'));

export const createFamily = (name: string, displayName: string) => q<string>(sb().rpc('create_family', { p_name: name, p_display_name: displayName }));
export const createCircle = (name: string, description: string, rules: string, displayName: string) =>
  q<string>(sb().rpc('create_circle', { p_name: name, p_description: description || null, p_rules: rules || null, p_display_name: displayName }));
export const updateFamily = (id: string, patch: { name?: string; wird?: string | null }) => q(sb().from('families').update(patch).eq('id', id));
export const updateCircle = (id: string, patch: { name?: string; description?: string | null; rules?: string | null }) => q(sb().from('circles').update(patch).eq('id', id));
export const leaveFamily = (familyId: string, userId: string) => q(sb().from('family_members').delete().eq('family_id', familyId).eq('user_id', userId));
export const removeFamilyMember = (memberId: string) => q(sb().from('family_members').delete().eq('id', memberId));
export const leaveCircle = (circleId: string, userId: string) => q(sb().from('circle_members').delete().eq('circle_id', circleId).eq('user_id', userId));
export const removeCircleMember = (circleId: string, userId: string) => q(sb().from('circle_members').delete().eq('circle_id', circleId).eq('user_id', userId));
export const setMemberRole = (memberId: string, role: FamilyRole) => q(sb().rpc('set_member_role', { p_member: memberId, p_role: role }));
export const setCircleRole = (circleId: string, userId: string, role: CircleRole) => q(sb().rpc('set_circle_role', { p_circle: circleId, p_user: userId, p_role: role }));
export const addManagedChild = (familyId: string, name: string) => q<string>(sb().rpc('add_managed_child', { p_family: familyId, p_display_name: name }));

// ---------- Invitations ----------
// Le serveur ne garde que l'empreinte (hash) des codes : le code en clair n'est connu qu'au moment de la création.
// On le garde sur cet appareil pour pouvoir le repartager ; ailleurs, il faut créer une nouvelle invitation.
const INVITE_CODES = 'community/invite-codes';
type LocalCode = { code: string; expires_at: string };
async function localCodes(): Promise<Record<string, LocalCode>> {
  const all = await loadJSON<Record<string, LocalCode>>(INVITE_CODES, {});
  const now = Date.now();
  return Object.fromEntries(Object.entries(all).filter(([, v]) => Date.parse(v.expires_at) > now));
}
export async function createInvitation(scope: ScopeType, scopeId: string, role: string, maxUses = 1, days = 7) {
  const rows = await q<{ id: string; code: string; expires_at: string }[]>(
    sb().rpc('create_invitation', { p_scope: scope, p_scope_id: scopeId, p_role: role, p_max_uses: maxUses, p_days: days }),
  );
  const r = rows[0];
  if (r) await saveJSON(INVITE_CODES, { ...(await localCodes()), [r.id]: { code: r.code, expires_at: r.expires_at } });
  return r;
}
const normCode = (code: string) => code.trim().toUpperCase();
export const previewInvitation = (code: string) => q<InvitePreview>(sb().rpc('preview_invitation', { p_code: normCode(code) }));
export async function acceptInvitation(code: string, displayName: string, acceptRules: boolean) {
  const r = await q<{ scope_type: ScopeType; id: string } | { error: string }>(
    sb().rpc('accept_invitation', { p_code: normCode(code), p_display_name: displayName, p_accept_rules: acceptRules }),
  );
  if ('error' in r) throw new CommunityError(L('Code invalide.'));
  return r;
}
export type Invitation = { id: string; code: string | null; role: string; uses: number; max_uses: number; expires_at: string; revoked_at: string | null };
export async function listInvitations(scope: ScopeType, id: string): Promise<Invitation[]> {
  const rows = await q<Omit<Invitation, 'code'>[]>(
    sb().from('invitations').select('id,role,uses,max_uses,expires_at,revoked_at').eq(scopeCol(scope), id).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
  );
  const codes = await localCodes();
  return rows.map((r) => ({ ...r, code: codes[r.id]?.code ?? null }));
}
export const revokeInvitation = (id: string) => q(sb().from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', id));
/** Places du cercle (limite décidée par le serveur ; 4 personnes, créateur inclus, en version gratuite). */
/** Droits du compte (plan, limites lues dans la base). */
export type MyEntitlements = { plan: string; limits: Record<string, unknown>; payments_enabled: boolean };
export const myEntitlements = () => q<MyEntitlements>(sb().rpc('get_my_entitlements'));
/** Personnes maximum dans un cercle créé par ce compte (créateur inclus), ou null si inconnu. */
export const myGroupCap = async () => {
  const n = Number((await myEntitlements()).limits?.max_group_members_created);
  return Number.isFinite(n) && n > 0 ? n : null;
};
export const groupCapacity = (circleId: string) => q<GroupCapacity>(sb().rpc('group_capacity', { p_circle: circleId }));

// ---------- Modération ----------
export const reportContent = (
  target: ReportTarget,
  targetId: string,
  reason: ReportReason,
  o: { details?: string; scope?: ScopeType; scopeId?: string; block?: boolean } = {},
) =>
  q<string>(
    sb().rpc('report_content', {
      p_target_type: target,
      p_target_id: targetId,
      p_reason: reason,
      p_details: o.details?.trim() || null,
      p_scope_type: o.scope ?? null,
      p_scope_id: o.scopeId ?? null,
      p_block: !!o.block,
    }),
  );
export const blockUser = (userId: string) => q(sb().rpc('block_user', { p_user: userId }));
export const unblockUser = (myId: string, userId: string) => q(sb().from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', userId));
export const listBlocks = () => q<Block[]>(sb().from('blocks').select('blocked_id,blocked_name,created_at').order('created_at', { ascending: false }));
export const MODERATION_EMAIL_FALLBACK = 'mohamadalhabib@live.com';
export async function moderationContact(): Promise<string> {
  try {
    const r = await q<{ email?: string }>(sb().rpc('moderation_contact'));
    return r?.email || MODERATION_EMAIL_FALLBACK;
  } catch {
    return MODERATION_EMAIL_FALLBACK;
  }
}

// ---------- Contrôle parental ----------
export const parentalControls = (familyId: string) =>
  q<ParentalControl[]>(sb().from('parental_controls').select('child_member_id,family_id,daily_minutes_limit,messaging,content_level').eq('family_id', familyId));
export const saveParentalControl = (pc: ParentalControl) => q(sb().from('parental_controls').upsert(pc, { onConflict: 'child_member_id' }));

// ---------- Partage ----------
export async function sharingMode(scope: ScopeType, id: string, userId: string): Promise<SharingMode> {
  const rows = await q<{ mode: SharingMode }[]>(sb().from('sharing_preferences').select('mode').eq('user_id', userId).eq(scopeCol(scope), id));
  return rows[0]?.mode ?? (scope === 'family' ? 'counter' : 'participation');
}
export async function setSharingMode(scope: ScopeType, id: string, userId: string, mode: SharingMode) {
  const rows = await q<{ id: string }[]>(sb().from('sharing_preferences').update({ mode, updated_at: new Date().toISOString() }).eq('user_id', userId).eq(scopeCol(scope), id).select('id'));
  if (!rows.length) await q(sb().from('sharing_preferences').insert({ user_id: userId, scope_type: scope, [scopeCol(scope)]: id, mode }));
}
export async function allSharingModes(userId: string) {
  return q<{ family_id: string | null; circle_id: string | null; mode: SharingMode }[]>(sb().from('sharing_preferences').select('family_id,circle_id,mode').eq('user_id', userId));
}

// ---------- Objectifs ----------
export const listGoals = (scope: ScopeType, id: string) =>
  q<Goal[]>(sb().from('shared_goals').select('id,scope_type,family_id,circle_id,title,formula,target,status,ends_on,created_at').eq(scopeCol(scope), id).neq('status', 'archived').order('created_at', { ascending: false }));
export const createGoal = (scope: ScopeType, id: string, userId: string, g: { title: string; formula?: string; target: number; ends_on?: string | null }) =>
  q(sb().from('shared_goals').insert({ scope_type: scope, [scopeCol(scope)]: id, created_by: userId, title: g.title, formula: g.formula || null, target: g.target, ends_on: g.ends_on || null }));
export const archiveGoal = (id: string) => q(sb().from('shared_goals').update({ status: 'archived' }).eq('id', id));
export const goalProgress = (goalId: string) => q<GoalProgress>(sb().rpc('goal_progress', { p_goal: goalId }));
export type ContributionRow = { goal_id: string; count: number; source: string; client_id: string; member_id?: string | null };
export async function insertContributions(userId: string, rows: ContributionRow[]) {
  if (!rows.length) return;
  const { error } = await sb()
    .from('goal_contributions')
    .upsert(rows.map((r) => ({ ...r, user_id: userId, member_id: r.member_id ?? null })), { onConflict: 'client_id', ignoreDuplicates: true });
  if (error) throw new CommunityError(frError(error), error.code);
}

// ---------- Calendrier ----------
export const listEvents = (familyId: string) =>
  q<CalendarEvent[]>(sb().from('family_calendar_events').select('id,family_id,title,kind,starts_at,all_day,notes').eq('family_id', familyId).gte('starts_at', new Date(Date.now() - 86400000).toISOString()).order('starts_at').limit(50));
export const createEvent = (familyId: string, userId: string, e: { title: string; kind: string; starts_at: string; all_day: boolean; notes?: string }) =>
  q(sb().from('family_calendar_events').insert({ family_id: familyId, created_by: userId, ...e, notes: e.notes || null }));
export const deleteEvent = (id: string) => q(sb().from('family_calendar_events').delete().eq('id', id));

// ---------- Encouragements ----------
export const listEncouragements = (scope: ScopeType, id: string) =>
  q<Encouragement[]>(sb().from('encouragements').select('id,scope_type,family_id,circle_id,sender_id,recipient_id,kind,body,created_at,read_at').eq(scopeCol(scope), id).order('created_at', { ascending: false }).limit(50));
export const sendEncouragement = (scope: ScopeType, id: string, senderId: string, recipientId: string, kind: string, body: string) =>
  q(sb().from('encouragements').insert({ scope_type: scope, [scopeCol(scope)]: id, sender_id: senderId, recipient_id: recipientId, kind, body }));
export const markRead = (id: string) => q(sb().from('encouragements').update({ read_at: new Date().toISOString() }).eq('id', id));

// ---------- Zikr en direct ----------
export const liveSessions = (scope: ScopeType, id: string) =>
  q<ZikrSession[]>(sb().from('zikr_sessions').select('id,scope_type,family_id,circle_id,title,formula,target,status,started_by,started_at').eq(scopeCol(scope), id).eq('status', 'live').order('started_at', { ascending: false }));
export const getSession = (id: string) => q<ZikrSession>(sb().from('zikr_sessions').select('id,scope_type,family_id,circle_id,title,formula,target,status,started_by,started_at').eq('id', id).single());
export async function startSession(scope: ScopeType, id: string, userId: string, s: { title: string; formula?: string; target?: number | null }) {
  const row = await q<{ id: string }>(
    sb().from('zikr_sessions').insert({ scope_type: scope, [scopeCol(scope)]: id, started_by: userId, title: s.title, formula: s.formula || null, target: s.target || null }).select('id').single(),
  );
  return row.id;
}
export const endSession = (id: string) => q(sb().from('zikr_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', id));
export const sessionCounts = (id: string) => q<SessionCount[]>(sb().from('zikr_session_counts').select('session_id,user_id,display_name,count').eq('session_id', id).order('count', { ascending: false }));
export const setSessionCount = (sessionId: string, userId: string, displayName: string, count: number) =>
  q(sb().from('zikr_session_counts').upsert({ session_id: sessionId, user_id: userId, display_name: displayName, count, updated_at: new Date().toISOString() }, { onConflict: 'session_id,user_id' }));

// ---------- Profil / compte ----------
export const getProfile = (id: string) => q<{ id: string; display_name: string; is_minor: boolean } | null>(sb().from('profiles').select('id,display_name,is_minor').eq('id', id).maybeSingle());
export const updateProfile = (id: string, display_name: string) => q(sb().from('profiles').update({ display_name }).eq('id', id));
export const deleteMyAccount = () => q(sb().rpc('delete_my_account'));
