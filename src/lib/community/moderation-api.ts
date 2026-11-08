/**
 * File de modération de la plateforme (Passe 6) : réservée aux comptes ayant le rôle serveur « moderator » ou
 * « admin » (private.app_roles, attribué par l'équipe dans la base — jamais depuis l'app). Tout est vérifié en base
 * (migration 20261101200000_passe6_moderation_push.sql) : l'app ne fait qu'afficher et appeler les RPC.
 * L'identité de la personne qui signale n'est jamais renvoyée par le serveur.
 * Chargé seulement avec l'écran /moderation.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../supabase';
import { CommunityError, frError, type ReportReason } from './api';

export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type QueueFilter = 'pending' | ReportStatus;
export type QueueItem = {
  id: string;
  created_at: string;
  status: ReportStatus;
  reason: ReportReason;
  target_type: 'message' | 'member' | 'circle' | 'session' | 'group_message';
  target_id: string | null;
  target_user_id: string | null;
  scope_type: 'family' | 'circle' | null;
  family_id: string | null;
  circle_id: string | null;
  reports_on_user: number;
  details: string | null;
  snapshot: { body?: string; kind?: string; sender_name?: string; created_at?: string } | null;
  resolution: string | null;
  handled_at: string | null;
};

type PgError = { message?: string; code?: string };
async function sb(): Promise<SupabaseClient> {
  const c = await getSupabase();
  if (!c) throw new CommunityError(frError(new CommunityError('Serveur non configuré.')));
  return c;
}
async function q<T>(p: PromiseLike<{ data: T | null; error: PgError | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new CommunityError(frError(error), error.code);
  return data as T;
}

export type ModerationBackend = {
  demo: boolean;
  /** Rôles serveur du compte connecté (vide si aucun). */
  roles(): Promise<string[]>;
  list(filter: QueueFilter): Promise<QueueItem[]>;
  setStatus(id: string, status: ReportStatus, resolution?: string): Promise<void>;
  /** Efface pour tous un message de groupe signalé (copie gardée au journal de l'équipe). */
  deleteGroupMessage(reportId: string): Promise<void>;
};

const live: ModerationBackend = {
  demo: false,
  roles: async () => (await q<string[] | null>(sb().then((c) => c.rpc('my_app_roles')))) ?? [],
  list: async (filter) => (await q<QueueItem[] | null>(sb().then((c) => c.rpc('moderation_queue_list', { p_status: filter, p_limit: 100 })))) ?? [],
  setStatus: async (id, status, resolution) => {
    await q(sb().then((c) => c.rpc('moderation_set_status', { p_report: id, p_status: status, p_resolution: resolution ?? null })));
  },
  deleteGroupMessage: async (reportId) => {
    await q(sb().then((c) => c.rpc('platform_delete_group_message', { p_report: reportId })));
  },
};

/** Démonstration locale (captures, revue) : EXPO_PUBLIC_CHAT_DEMO=1 au build. Exemples fictifs, rien n'est envoyé. */
function demo(): ModerationBackend {
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  let items: QueueItem[] = [
    {
      id: 'demo-1', created_at: ago(2), status: 'open', reason: 'spam', target_type: 'group_message', target_id: 'm1',
      target_user_id: 'u1', scope_type: 'circle', family_id: null, circle_id: 'demo', reports_on_user: 2, details: null,
      snapshot: { body: 'Gagnez 500 € en un clic : https://exemple.invalid', kind: 'text', sender_name: 'Compte test' },
      resolution: null, handled_at: null,
    },
    {
      id: 'demo-2', created_at: ago(20), status: 'reviewing', reason: 'harassment', target_type: 'group_message', target_id: 'm2',
      target_user_id: 'u2', scope_type: 'circle', family_id: null, circle_id: 'demo', reports_on_user: 1, details: 'Messages répétés',
      snapshot: { body: 'Réponds-moi tout de suite.', kind: 'text', sender_name: 'Compte test 2' }, resolution: null, handled_at: null,
    },
  ];
  return {
    demo: true,
    roles: async () => ['moderator'],
    list: async (f) => items.filter((i) => (f === 'pending' ? i.status === 'open' || i.status === 'reviewing' : i.status === f)),
    setStatus: async (id, status, resolution) => {
      items = items.map((i) => (i.id === id ? { ...i, status, resolution: resolution ?? i.resolution, handled_at: new Date().toISOString() } : i));
    },
    deleteGroupMessage: async (id) => {
      items = items.map((i) => (i.id === id ? { ...i, snapshot: { ...i.snapshot, body: '' } } : i));
    },
  };
}

let cached: ModerationBackend | null = null;
export function moderationBackend(): ModerationBackend {
  return (cached ??= process.env.EXPO_PUBLIC_CHAT_DEMO === '1' ? demo() : live);
}

/** Droit d'accès à la file (affichage seulement : le serveur revérifie à chaque appel). */
export const isPlatformModerator = (roles: string[]) => roles.includes('moderator') || roles.includes('admin');
