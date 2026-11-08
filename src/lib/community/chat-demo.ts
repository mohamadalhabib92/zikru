/**
 * Démonstration locale de la discussion (captures d'écran, revue) : prénoms fictifs, aucun serveur,
 * rien n'est envoyé. Activée seulement par EXPO_PUBLIC_CHAT_DEMO=1 au build (jamais dans la PWA publiée).
 * Les textes « Bravo », « Du‘a », « Rappel », « Salām » reprennent ceux des encouragements existants.
 */
import type { ChatBackend } from './chat-api';
import type { ChatMessage, ChatScope } from './chat-core';

export const DEMO_ME = '00000000-0000-4000-8000-00000000d000';
const A = '00000000-0000-4000-8000-00000000d001';
const B = '00000000-0000-4000-8000-00000000d002';
const C = '00000000-0000-4000-8000-00000000d003';
const now = Date.now();
const at = (min: number) => new Date(now - min * 60_000).toISOString();
let seq = 0;
const m = (sender: string, name: string, minAgo: number, kind: ChatMessage['kind'], body: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  scope_type: 'circle',
  family_id: null,
  circle_id: 'demo',
  sender_id: sender,
  sender_name: name,
  kind,
  body,
  reply_to: null,
  client_id: null,
  created_at: at(minAgo),
  deleted_at: null,
  ...extra,
});
const rows: ChatMessage[] = [
  m(A, 'Aïcha', 26 * 60, 'salam', 'As-salāmu ‘alaykum, je pense à toi.'),
  m(B, 'Moussa', 26 * 60 - 3, 'text', 'Wa ‘alaykum salām ! On fait le wird ensemble ce soir ?'),
  m(A, 'Aïcha', 50, 'text', 'Oui, après le repas. Je lance une séance en direct.'),
  m(A, 'Aïcha', 48, 'rappel', 'Petit rappel affectueux pour ton wird du jour.'),
  m(C, 'Mariam', 30, 'text', '', { deleted_at: at(29) }),
  m(DEMO_ME, 'Moi', 12, 'text', 'Je serai là in shā’ Allāh.'),
  m(B, 'Moussa', 5, 'bravo', 'Bravo, machā’Allāh ! Continue ainsi.'),
];
rows.push(m(C, 'Mariam', 2, 'dua', 'Qu’Allah te bénisse et facilite tes affaires.', { reply_to: rows[5].id }));
let muted = false;

const fix = (scope: ChatScope, id: string, r: ChatMessage): ChatMessage => ({ ...r, scope_type: scope, family_id: scope === 'family' ? id : null, circle_id: scope === 'circle' ? id : null });

export const demoBackend: ChatBackend = {
  demo: true,
  rights: async () => ({ member: true, role: 'founder', can_post: true, can_moderate: true, audience: 'all' }),
  list: async (scope, id, before) => (before ? [] : rows.map((r) => fix(scope, id, r))),
  since: async () => [],
  async post(o) {
    const r: ChatMessage = { ...m(DEMO_ME, 'Moi', 0, o.kind, o.body, { reply_to: o.reply_to, client_id: o.client_id }), created_at: new Date().toISOString() };
    rows.push(r);
    return fix(o.scope, o.scope_id, r);
  },
  async remove(id) {
    const r = rows.find((x) => x.id === id);
    if (r) Object.assign(r, { body: '', deleted_at: new Date().toISOString() });
  },
  markRead: async () => {},
  setMuted: async (_s, _i, v) => {
    muted = v;
  },
  muted: async () => muted,
  subscribe: (_s, _i, _r, onState) => {
    onState(false);
    return () => {};
  },
};
