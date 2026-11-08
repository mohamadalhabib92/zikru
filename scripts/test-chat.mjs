// Tests de la discussion de groupe (Passe 5) : fusion serveur + envois en attente sans doublon, regroupement
// par jour et par auteur, file hors ligne (reprise progressive, erreurs définitives), brouillon ≤ 2000,
// droits de suppression / signalement, non lus, citation, identifiant d'envoi.
process.env.TZ = 'Europe/Zurich';
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'community/chat-core': C } = await loadLib(['community/chat-core'], 'chat');
let ok = 0;
const test = (n, f) => {
  f();
  ok++;
  console.log('✓', n);
};
const FAM = 'fam-1';
const msg = (id, sender, at, extra = {}) => ({
  id, scope_type: 'family', family_id: FAM, circle_id: null, sender_id: sender, sender_name: sender.toUpperCase(), kind: 'text',
  body: 'texte ' + id, reply_to: null, client_id: 'c-' + id, created_at: at, deleted_at: null, ...extra,
});
const out = (cid, at, extra = {}) => ({
  client_id: cid, scope: 'family', scope_id: FAM, sender_id: 'me', body: 'local ' + cid, kind: 'text', reply_to: null,
  created_at: at, attempts: 0, next_at: 0, status: 'pending', ...extra,
});

test('constantes : 2000 caractères, 5 min, colonnes explicites sans deleted_by', () => {
  assert.equal(C.MAX_LEN, 2000);
  assert.equal(C.GROUP_WINDOW_MS, 300000);
  assert.ok(!C.MESSAGE_COLUMNS.includes('deleted_by'));
  assert.ok(!C.MESSAGE_COLUMNS.includes('*'));
  assert.deepEqual(C.CHAT_KINDS, ['text', 'bravo', 'dua', 'rappel', 'salam']);
});

test('brouillon : vide, espaces, limite exacte, emoji comptés comme 1', () => {
  assert.equal(C.validateDraft('   ').ok, false);
  assert.equal(C.validateDraft('').error, 'empty');
  assert.equal(C.validateDraft('  salam  ').text, 'salam');
  assert.equal(C.validateDraft('a'.repeat(2000)).ok, true);
  assert.equal(C.validateDraft('a'.repeat(2001)).error, 'too_long');
  assert.equal(C.validateDraft('🤲'.repeat(2000)).ok, true);
});

test('fusion : union par id, version reçue en dernier gagne, tri chronologique', () => {
  const a = [msg('2', 'x', '2027-01-01T10:02:00Z'), msg('1', 'x', '2027-01-01T10:00:00Z')];
  const m = C.mergeMessages(a, [msg('2', 'x', '2027-01-01T10:02:00Z', { body: '', deleted_at: '2027-01-01T11:00:00Z' }), msg('3', 'y', '2027-01-01T09:00:00Z')]);
  assert.deepEqual(m.map((x) => x.id), ['3', '1', '2']);
  assert.ok(m[2].deleted_at);
});

test('direct : un message d’un autre groupe est ignoré', () => {
  const l = [msg('1', 'x', '2027-01-01T10:00:00Z')];
  assert.equal(C.applyIncoming(l, { ...msg('9', 'x', '2027-01-01T10:01:00Z'), family_id: 'autre' }, 'family', FAM).length, 1);
  assert.equal(C.applyIncoming(l, { ...msg('9', 'x', '2027-01-01T10:01:00Z'), scope_type: 'circle', family_id: null, circle_id: FAM }, 'family', FAM).length, 1);
  assert.equal(C.applyIncoming(l, msg('9', 'x', '2027-01-01T10:01:00Z'), 'family', FAM).length, 2);
});

test('fil : envoi en attente affiché, puis remplacé par la version serveur (même client_id, pas de doublon)', () => {
  const ob = [out('c-5', '2027-01-01T10:05:00Z'), out('c-6', '2027-01-01T10:06:00Z', { status: 'failed', error: 'refusé' }), { ...out('c-7', '2027-01-01T10:07:00Z'), scope_id: 'autre' }];
  let tl = C.buildTimeline([msg('1', 'x', '2027-01-01T10:00:00Z')], ob, 'me', 'family', FAM);
  assert.deepEqual(tl.map((i) => i.delivery), ['sent', 'pending', 'failed']);
  assert.equal(tl[2].error, 'refusé');
  assert.ok(tl[1].mine && !tl[0].mine);
  tl = C.buildTimeline([msg('1', 'x', '2027-01-01T10:00:00Z'), msg('5', 'me', '2027-01-01T10:05:01Z')], ob, 'me', 'family', FAM);
  assert.equal(tl.length, 3);
  assert.equal(tl.filter((i) => i.msg.client_id === 'c-5').length, 1);
  assert.equal(tl.find((i) => i.msg.client_id === 'c-5').delivery, 'sent');
  // Clé stable pendant la confirmation (pas de saut de liste).
  assert.equal(tl.find((i) => i.msg.client_id === 'c-5').key, 'c-5');
});

test('fil : la file d’un autre compte sur le même appareil n’est jamais affichée', () => {
  const tl = C.buildTimeline([], [{ ...out('c-1', '2027-01-01T10:00:00Z'), sender_id: 'autre' }], 'me', 'family', FAM);
  assert.equal(tl.length, 0);
});

test('regroupement : même auteur < 5 min = une suite ; nouveau jour = séparateur', () => {
  const l = [
    msg('1', 'x', '2027-01-01T10:00:00Z'), msg('2', 'x', '2027-01-01T10:04:00Z'), msg('3', 'x', '2027-01-01T10:10:00Z'),
    msg('4', 'y', '2027-01-01T10:11:00Z'), msg('5', 'y', '2027-01-01T23:30:00Z'),
  ];
  const tl = C.buildTimeline(l, [], 'me', 'family', FAM);
  assert.deepEqual(tl.map((i) => [i.first, i.last]), [[true, false], [false, true], [true, true], [true, true], [true, true]]);
  assert.deepEqual(tl.map((i) => i.showDay), [true, false, false, false, true]); // 23:30 UTC = 00:30 à Zurich le 2 janvier
  assert.equal(tl[4].day, '2027-01-02');
});

test('reprise progressive : 2 s, 5 s … plafonnée à 2 min', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 40].map(C.backoffMs), [2000, 5000, 15000, 30000, 60000, 120000, 120000, 120000]);
});

test('erreurs : filtre / droits / format = définitif ; réseau / débit = on réessaie', () => {
  for (const c of ['ZKF01', '42501', '23514']) assert.equal(C.classifyError(c), 'permanent');
  assert.equal(C.classifyError(undefined, 'new row violates row-level security policy'), 'permanent');
  assert.equal(C.classifyError(undefined, 'Failed to fetch'), 'retry');
  assert.equal(C.classifyError('ZKR01'), 'retry');
  assert.equal(C.classifyError('57014'), 'retry');
});

test('file : ajout sans doublon, échec passager puis définitif, réessai manuel, envoi réussi retiré', () => {
  let ob = C.enqueue([], out('a', '2027-01-01T10:00:00Z'));
  ob = C.enqueue(ob, out('a', '2027-01-01T10:00:00Z'));
  assert.equal(ob.length, 1);
  ob = C.markFailed(ob, 'a', 'hors ligne', false, 1000);
  assert.equal(ob[0].status, 'pending');
  assert.equal(ob[0].next_at, 1000 + 5000);
  assert.equal(C.dueItems(ob, 3000).length, 0);
  assert.equal(C.dueItems(ob, 6000).length, 1);
  ob = C.markFailed(ob, 'a', 'débit', false, 1000, 90);
  assert.equal(ob[0].next_at, 91000, 'le délai du serveur (retry_after_s) est respecté');
  ob = C.markFailed(ob, 'a', 'refusé', true, 1000);
  assert.equal(ob[0].status, 'failed');
  assert.equal(C.dueItems(ob, 1e12).length, 0, 'un échec définitif ne repart pas tout seul');
  ob = C.retryNow(ob, 'a', 5);
  assert.equal(C.dueItems(ob, 5).length, 1);
  assert.equal(C.removeSent(ob, 'a').length, 0);
});

test('file : plafond 200, ordre d’envoi chronologique, données abîmées écartées', () => {
  let ob = [];
  for (let i = 0; i < 205; i++) ob = C.enqueue(ob, out('k' + i, new Date(Date.UTC(2027, 0, 1, 0, 0, i)).toISOString()));
  assert.equal(ob.length, 200);
  assert.equal(ob[0].client_id, 'k5');
  assert.deepEqual(C.dueItems([out('b', '2027-01-01T10:01:00Z'), out('a', '2027-01-01T10:00:00Z')], 0).map((o) => o.client_id), ['a', 'b']);
  const n = C.normalizeOutbox([null, 3, { client_id: 'x' }, { ...out('ok', '2027-01-01T10:00:00Z'), attempts: 'n' }, { ...out('k', '2027-01-01T10:00:00Z'), kind: 'pub' }, { ...out('s', '2027-01-01T10:00:00Z'), scope: 'oumma' }]);
  assert.deepEqual(n.map((o) => o.client_id), ['ok']);
  assert.equal(n[0].attempts, 0);
  assert.deepEqual(C.normalizeOutbox('abîmé'), []);
});

test('non lus : ni les miens, ni les supprimés ; pastille 99+', () => {
  const l = [msg('1', 'x', '2027-01-01T10:00:00Z'), msg('2', 'me', '2027-01-01T10:01:00Z'), msg('3', 'x', '2027-01-01T10:02:00Z', { deleted_at: '2027-01-01T10:03:00Z' }), msg('4', 'y', '2027-01-01T10:04:00Z')];
  assert.equal(C.unreadCount(l, 'me', null), 2);
  assert.equal(C.unreadCount(l, 'me', '2027-01-01T10:00:00Z'), 1);
  assert.deepEqual([0, 1, 99, 100].map(C.badgeText), ['', '1', '99', '99+']);
});

test('droits : supprimer = auteur ou modération ; signaler = message d’autrui envoyé', () => {
  const mine = msg('1', 'me', '2027-01-01T10:00:00Z');
  const other = msg('2', 'x', '2027-01-01T10:00:00Z');
  const gone = msg('3', 'x', '2027-01-01T10:00:00Z', { deleted_at: '2027-01-01T11:00:00Z', body: '' });
  const local = { ...mine, id: 'local:c-1' };
  assert.equal(C.canDelete(mine, 'me', false), true);
  assert.equal(C.canDelete(other, 'me', false), false);
  assert.equal(C.canDelete(other, 'me', true), true);
  assert.equal(C.canDelete(gone, 'me', true), false);
  assert.equal(C.canDelete(local, 'me', true), false);
  assert.equal(C.canReport(other, 'me'), true);
  assert.equal(C.canReport(mine, 'me'), false);
  assert.equal(C.canReport(gone, 'me'), false);
});

test('citation : une ligne, 90 caractères, message supprimé ou introuvable signalé', () => {
  const q = C.quotePreview(msg('1', 'x', '2027-01-01T10:00:00Z', { body: 'ligne 1\n\nligne 2 ' + 'é'.repeat(100) }));
  assert.equal([...q.text].length, 90);
  assert.ok(q.text.startsWith('ligne 1 ligne 2') && q.text.endsWith('…'));
  assert.equal(C.quotePreview(undefined).missing, true);
  assert.equal(C.quotePreview(msg('1', 'x', '2027-01-01T10:00:00Z', { deleted_at: 'x' })).missing, true);
});

test('identifiant d’envoi : UUID v4 valide, différent à chaque fois', () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const a = C.newClientId(rand);
  assert.match(a, re);
  assert.notEqual(a, C.newClientId(rand));
  assert.match(C.newClientId(), re);
  assert.equal(C.oldestAt([]), null);
});

console.log(`test-chat OK : ${ok} tests`);
