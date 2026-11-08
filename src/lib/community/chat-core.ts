/**
 * Discussion de groupe (Passe 5) : logique pure, sans React ni réseau (testée par scripts/test-chat.mjs).
 * Fusion serveur + envois en attente (par client_id), regroupement par jour et par auteur,
 * file d'envoi hors ligne avec reprise progressive, validation du brouillon, droits de suppression.
 * Chiffré en transit (TLS), pas encore de bout en bout : rien ici ne prétend le contraire.
 */
export type ChatScope = 'family' | 'circle';
export type ChatKind = 'text' | 'bravo' | 'dua' | 'rappel' | 'salam';
export const CHAT_KINDS: ChatKind[] = ['text', 'bravo', 'dua', 'rappel', 'salam'];
export const MAX_LEN = 2000;
export const GROUP_WINDOW_MS = 5 * 60 * 1000;
export const OUTBOX_MAX = 200;
export const POLL_MS = 20_000;
export const PAGE = 50;

export type ChatMessage = {
  id: string;
  scope_type: ChatScope;
  family_id: string | null;
  circle_id: string | null;
  sender_id: string;
  sender_name: string;
  kind: ChatKind;
  body: string;
  reply_to: string | null;
  client_id: string | null;
  created_at: string;
  deleted_at: string | null;
};
/** Colonnes lisibles (la base refuse `deleted_by` : on liste toujours les colonnes). */
export const MESSAGE_COLUMNS = 'id,scope_type,family_id,circle_id,sender_id,sender_name,kind,body,reply_to,client_id,created_at,deleted_at';

export type Outgoing = {
  client_id: string;
  scope: ChatScope;
  scope_id: string;
  sender_id: string;
  body: string;
  kind: ChatKind;
  reply_to: string | null;
  created_at: string;
  attempts: number;
  next_at: number;
  status: 'pending' | 'failed';
  error?: string;
  permanent?: boolean;
};

export type Delivery = 'sent' | 'pending' | 'failed';
export type TimelineItem = {
  key: string;
  msg: ChatMessage;
  mine: boolean;
  delivery: Delivery;
  error?: string;
  /** Premier message d'une suite du même auteur (afficher le nom). */
  first: boolean;
  /** Dernier d'une suite (afficher l'heure). */
  last: boolean;
  /** Jour local AAAA-MM-JJ ; `showDay` = séparateur avant ce message. */
  day: string;
  showDay: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const ts = (iso: string) => {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
};
const byTime = (a: ChatMessage, b: ChatMessage) => ts(a.created_at) - ts(b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Brouillon : espaces retirés aux bords, non vide, ≤ 2000 caractères. */
export function validateDraft(s: string): { ok: true; text: string } | { ok: false; error: 'empty' | 'too_long'; text: string } {
  const text = (s ?? '').trim();
  if (!text) return { ok: false, error: 'empty', text };
  if ([...text].length > MAX_LEN) return { ok: false, error: 'too_long', text };
  return { ok: true, text };
}

/** Union par id : la version reçue en dernier gagne (suppression, correction), tri chronologique. */
export function mergeMessages(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of base) map.set(m.id, m);
  for (const m of incoming) if (m && m.id) map.set(m.id, m);
  return [...map.values()].sort(byTime);
}

/** Message reçu en direct : ajouté seulement s'il appartient au groupe affiché. */
export function applyIncoming(list: ChatMessage[], row: ChatMessage, scope: ChatScope, scopeId: string): ChatMessage[] {
  const sid = scope === 'family' ? row.family_id : row.circle_id;
  if (row.scope_type !== scope || sid !== scopeId) return list;
  return mergeMessages(list, [row]);
}

function pendingAsMessage(o: Outgoing): ChatMessage {
  return {
    id: 'local:' + o.client_id,
    scope_type: o.scope,
    family_id: o.scope === 'family' ? o.scope_id : null,
    circle_id: o.scope === 'circle' ? o.scope_id : null,
    sender_id: o.sender_id,
    sender_name: '',
    kind: o.kind,
    body: o.body,
    reply_to: o.reply_to,
    client_id: o.client_id,
    created_at: o.created_at,
    deleted_at: null,
  };
}

/** Fil affiché : messages du serveur + envois de cet appareil pas encore confirmés (sans doublon). */
export function buildTimeline(server: ChatMessage[], outbox: Outgoing[], me: string, scope: ChatScope, scopeId: string): TimelineItem[] {
  const confirmed = new Set(server.map((m) => m.client_id).filter(Boolean) as string[]);
  const local = outbox.filter((o) => o.scope === scope && o.scope_id === scopeId && o.sender_id === me && !confirmed.has(o.client_id));
  const state = new Map(local.map((o) => [o.client_id, o]));
  const all = [...server, ...local.map(pendingAsMessage)].sort(byTime);
  return all.map((msg, i) => {
    const prev = all[i - 1];
    const next = all[i + 1];
    const day = dayKey(msg.created_at);
    const same = (a?: ChatMessage, b?: ChatMessage) =>
      !!a && !!b && a.sender_id === b.sender_id && dayKey(a.created_at) === dayKey(b.created_at) && Math.abs(ts(b.created_at) - ts(a.created_at)) <= GROUP_WINDOW_MS && !a.deleted_at && !b.deleted_at;
    const o = msg.client_id ? state.get(msg.client_id) : undefined;
    const isLocal = msg.id.startsWith('local:');
    return {
      key: msg.client_id ?? msg.id,
      msg,
      mine: msg.sender_id === me,
      delivery: isLocal ? (o?.status === 'failed' ? 'failed' : 'pending') : 'sent',
      error: isLocal ? o?.error : undefined,
      first: !same(prev, msg),
      last: !same(msg, next),
      day,
      showDay: !prev || dayKey(prev.created_at) !== day,
    };
  });
}

/** Reprise progressive : 2 s, 5 s, 15 s, 30 s, 60 s puis toutes les 2 min. */
const STEPS = [2, 5, 15, 30, 60, 120];
export const backoffMs = (attempts: number) => STEPS[Math.min(Math.max(attempts, 0), STEPS.length - 1)] * 1000;

/** Erreur définitive (on n'insiste pas) ou passagère (réseau, débit, serveur). */
export function classifyError(code: string | undefined, message = ''): 'permanent' | 'retry' {
  if (code === 'ZKF01' || code === '42501' || code === '23514' || code === '22023' || code === 'P0002') return 'permanent';
  if (/row-level security|permission denied|non autoris/i.test(message)) return 'permanent';
  return 'retry';
}

export function enqueue(outbox: Outgoing[], o: Outgoing): Outgoing[] {
  const rest = outbox.filter((x) => x.client_id !== o.client_id);
  return [...rest, o].slice(-OUTBOX_MAX);
}
export const removeSent = (outbox: Outgoing[], clientId: string) => outbox.filter((o) => o.client_id !== clientId);
/** Échec : définitif → « Échec » (bouton Réessayer) ; passager → nouvel essai plus tard (`retryAfterS` du serveur si fourni). */
export function markFailed(outbox: Outgoing[], clientId: string, error: string, permanent: boolean, now: number, retryAfterS?: number): Outgoing[] {
  return outbox.map((o) => {
    if (o.client_id !== clientId) return o;
    const attempts = o.attempts + 1;
    const wait = retryAfterS && retryAfterS > 0 ? retryAfterS * 1000 : backoffMs(attempts);
    return { ...o, attempts, error, permanent, status: permanent ? 'failed' : 'pending', next_at: now + wait };
  });
}
/** « Réessayer » à la main : repart tout de suite. */
export const retryNow = (outbox: Outgoing[], clientId: string, now: number) =>
  outbox.map((o) => (o.client_id === clientId ? { ...o, status: 'pending' as const, permanent: false, error: undefined, next_at: now } : o));
/** Envois à tenter maintenant, du plus ancien au plus récent. */
export const dueItems = (outbox: Outgoing[], now: number) => outbox.filter((o) => o.status === 'pending' && o.next_at <= now).sort((a, b) => ts(a.created_at) - ts(b.created_at));
/** File relue du stockage : on écarte les entrées abîmées. */
export function normalizeOutbox(v: unknown): Outgoing[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((o): o is Outgoing => !!o && typeof o === 'object' && typeof (o as Outgoing).client_id === 'string' && typeof (o as Outgoing).body === 'string' && typeof (o as Outgoing).scope_id === 'string')
    .filter((o) => (o.scope === 'family' || o.scope === 'circle') && CHAT_KINDS.includes(o.kind))
    .map((o): Outgoing => ({ ...o, attempts: Number(o.attempts) || 0, next_at: Number(o.next_at) || 0, status: o.status === 'failed' ? 'failed' : 'pending', reply_to: o.reply_to ?? null }))
    .slice(-OUTBOX_MAX);
}

/** Non lus (calcul local, quand le serveur n'a pas encore répondu). */
export const unreadCount = (list: ChatMessage[], me: string, lastReadAt: string | null) =>
  list.filter((m) => m.sender_id !== me && !m.deleted_at && (!lastReadAt || ts(m.created_at) > ts(lastReadAt))).length;
export const badgeText = (n: number) => (n <= 0 ? '' : n > 99 ? '99+' : String(n));

/** « Supprimer pour tous » : l'auteur, ou la modération (fondateur/modérateur du cercle, parent de la famille). */
export const canDelete = (m: ChatMessage, me: string, canModerate: boolean) => !m.deleted_at && !m.id.startsWith('local:') && (m.sender_id === me || canModerate);
/** Signaler / bloquer : seulement le message de quelqu'un d'autre, envoyé et non supprimé. */
export const canReport = (m: ChatMessage, me: string) => !m.deleted_at && !m.id.startsWith('local:') && m.sender_id !== me;

/** Aperçu d'une citation (une ligne, 90 caractères). */
export function quotePreview(m: ChatMessage | undefined, max = 90): { name: string; text: string; missing: boolean } {
  if (!m) return { name: '', text: '', missing: true };
  const flat = m.body.replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  return { name: m.sender_name, text: chars.length > max ? chars.slice(0, max - 1).join('') + '…' : flat, missing: !!m.deleted_at };
}

/** Identifiant d'envoi (UUID v4) : sert à ne jamais dupliquer un message renvoyé hors ligne. */
export function newClientId(rand: () => number = Math.random): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (rand === Math.random && c?.randomUUID) return c.randomUUID();
  const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
  h[12] = '4';
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Plus ancien message chargé (pagination vers le haut). */
export const oldestAt = (list: ChatMessage[]) => (list.length ? list[0].created_at : null);
