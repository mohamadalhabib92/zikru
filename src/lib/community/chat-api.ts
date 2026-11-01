/**
 * Discussion de groupe (Passe 5) : accès serveur, chargé seulement avec l'écran de discussion.
 * Toute la sécurité est en base (RLS + fonctions privées) : qui lit quoi (règle parentale, invités, blocages),
 * débit, filtre, liens, suppression. Chiffré en transit (TLS), pas encore de bout en bout.
 * Temps réel Supabase quand il est disponible, sinon relève toutes les 20 s : l'écran ne dépend jamais du direct.
 */
import { loadJSON, saveJSON } from '../storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../supabase';
import { CommunityError, frError } from './api';
import { MESSAGE_COLUMNS, normalizeOutbox, PAGE, type ChatKind, type ChatMessage, type ChatScope, type Outgoing } from './chat-core';

export type ChatRights = {
  member: boolean;
  role?: string;
  can_post?: boolean;
  can_moderate?: boolean;
  /** Qui lit : tout le groupe, seulement les parents (enfant), la famille sans invités, personne d'enfant (invité), personne. */
  audience?: 'all' | 'parents' | 'family_no_guests' | 'no_children' | 'none';
};

type PgError = { message?: string; code?: string; details?: string | null };
export class ChatError extends CommunityError {
  retryAfterS?: number;
}
function fail(e: PgError): never {
  const err = new ChatError(frError(e), e.code);
  try {
    const d = e.details ? (JSON.parse(e.details) as { retry_after_s?: number }) : {};
    if (Number(d.retry_after_s) > 0) err.retryAfterS = Number(d.retry_after_s);
  } catch {
    /* détail non JSON */
  }
  throw err;
}
/** Client Supabase (chargé à la demande) ; rejette si le serveur n'est pas configuré. */
async function sb(): Promise<SupabaseClient> {
  const c = await getSupabase();
  if (!c) throw new ChatError(frError(new CommunityError('Serveur non configuré.')));
  return c;
}
async function q<T>(p: PromiseLike<{ data: T | null; error: PgError | null }>): Promise<T> {
  let res: { data: T | null; error: PgError | null };
  try {
    res = await p;
  } catch (e) {
    return fail({ message: e instanceof Error ? e.message : String(e) });
  }
  if (res.error) fail(res.error);
  return res.data as T;
}
const col = (s: ChatScope) => (s === 'family' ? 'family_id' : 'circle_id');

export type ChatBackend = {
  demo: boolean;
  rights(scope: ChatScope, id: string): Promise<ChatRights>;
  /** Derniers messages (ou plus anciens que `before`), du plus ancien au plus récent. */
  list(scope: ChatScope, id: string, before?: string | null): Promise<ChatMessage[]>;
  /** Messages créés ou modifiés depuis `since` (relève sans temps réel). */
  since(scope: ChatScope, id: string, since: string): Promise<ChatMessage[]>;
  post(o: Outgoing): Promise<ChatMessage>;
  remove(id: string): Promise<void>;
  markRead(scope: ChatScope, id: string): Promise<void>;
  setMuted(scope: ChatScope, id: string, muted: boolean): Promise<void>;
  muted(scope: ChatScope, id: string): Promise<boolean>;
  /** Abonnement direct ; renvoie la fonction de désabonnement et signale l'état (true = direct actif). */
  subscribe(scope: ChatScope, id: string, onRow: (m: ChatMessage) => void, onState: (live: boolean) => void): () => void;
};

export const serverBackend: ChatBackend = {
  demo: false,
  rights: (scope, id) => q<ChatRights>(sb().then((c) => c.rpc('group_chat_rights', { p_scope: scope, p_scope_id: id }))),
  async list(scope, id, before) {
    const c = await sb();
    let r = c.from('group_messages').select(MESSAGE_COLUMNS).eq(col(scope), id).order('created_at', { ascending: false }).limit(PAGE);
    if (before) r = r.lt('created_at', before);
    const rows = await q<ChatMessage[]>(r);
    return [...(rows ?? [])].reverse();
  },
  async since(scope, id, since) {
    // Nouveaux messages + suppressions récentes (deleted_at), dans la limite d'une page.
    const rows = await q<ChatMessage[]>(
      sb().then((c) => c.from('group_messages').select(MESSAGE_COLUMNS).eq(col(scope), id).or(`created_at.gt.${since},deleted_at.gt.${since}`).order('created_at', { ascending: true }).limit(PAGE)),
    );
    return rows ?? [];
  },
  post: (o) =>
    q<ChatMessage>(
      sb().then((c) => c.rpc('post_group_message', { p_scope: o.scope, p_scope_id: o.scope_id, p_body: o.body, p_kind: o.kind, p_reply_to: o.reply_to, p_client_id: o.client_id })),
    ),
  remove: (id) => q<void>(sb().then((c) => c.rpc('delete_group_message', { p_id: id }))),
  markRead: (scope, id) => q<void>(sb().then((c) => c.rpc('mark_group_read', { p_scope: scope, p_scope_id: id }))),
  setMuted: (scope, id, muted) => q<void>(sb().then((c) => c.rpc('set_group_muted', { p_scope: scope, p_scope_id: id, p_muted: muted }))),
  async muted(scope, id) {
    const rows = await q<{ muted: boolean }[]>(sb().then((c) => c.from('group_prefs').select('muted').eq(col(scope), id).limit(1)));
    return !!rows?.[0]?.muted;
  },
  subscribe(scope, id, onRow, onState) {
    // Client chargé à la demande : l'abonnement démarre dès qu'il est prêt (désabonnement possible avant).
    let stop: (() => void) | null = null;
    let off = false;
    void getSupabase().then((c) => {
      if (off) return;
      if (!c) return onState(false);
      try {
        const ch = c
          .channel(`gm:${scope}:${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: `${col(scope)}=eq.${id}` }, (p: { new?: unknown }) => {
            const row = p.new as ChatMessage | undefined;
            if (row && row.id) onRow(row);
          })
          .subscribe((status: string) => onState(status === 'SUBSCRIBED'));
        stop = () => void c.removeChannel(ch);
      } catch {
        onState(false);
      }
    });
    return () => {
      off = true;
      stop?.();
    };
  },
};

/** Mode démonstration (captures d'écran, revue) : EXPO_PUBLIC_CHAT_DEMO=1 au moment du build. Jamais actif sinon. */
export async function chatBackend(): Promise<ChatBackend> {
  if (process.env.EXPO_PUBLIC_CHAT_DEMO === '1') {
    const m = await import('./chat-demo');
    return m.demoBackend;
  }
  return serverBackend;
}

// ---------- File d'envoi hors ligne (sur cet appareil, jamais envoyée ailleurs que dans le groupe choisi) ----------
const OUTBOX_KEY = 'community/chat-outbox';
export const loadOutbox = async () => normalizeOutbox(await loadJSON<unknown>(OUTBOX_KEY, []));
export const saveOutbox = (o: Outgoing[]) => saveJSON(OUTBOX_KEY, o);
/** Brouillons par groupe (texte seulement, sur cet appareil). */
const DRAFTS_KEY = 'community/chat-drafts';
export const loadDrafts = () => loadJSON<Record<string, string>>(DRAFTS_KEY, {});
export const saveDrafts = (d: Record<string, string>) => saveJSON(DRAFTS_KEY, d);
export type { ChatKind };
