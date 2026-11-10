// Appels de groupe v1 : logique pure de l'app (src/lib/calls/core.ts), noyau de l'Edge Function call-token
// (supabase/functions/call-token/livekit.ts) et isolement du module d'appel. Les règles d'accès (membres,
// parents, blocages, mineurs, limites) sont testées en SQL : supabase/tests/appels_test.sql.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { loadLib } from './load-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
const { 'calls/core': C } = await loadLib(['calls/core'], 'calls');

// --- core.ts ---
assert.equal(C.LABEL_TRANSIT, 'chiffré en transit, pas encore de bout en bout');
assert.deepEqual(C.availability(null, { missing: true, nativeOk: true }), { kind: 'soon' }, 'RPC absente → Bientôt disponible');
assert.deepEqual(C.availability(null, { nativeOk: true }), { kind: 'hidden' });
assert.deepEqual(C.availability({ member: false, enabled: true }, { nativeOk: true }), { kind: 'hidden' });
assert.deepEqual(C.availability({ member: true, enabled: false }, { nativeOk: true }), { kind: 'soon' }, 'interrupteur serveur coupé');
const ok = { member: true, enabled: true, can_join: true, video: true, admin: false, max_participants: 8 };
assert.deepEqual(C.availability(ok, { nativeOk: false }), { kind: 'soon' }, 'build sans module natif (build 61) → Bientôt disponible');
assert.deepEqual(C.availability(ok, { nativeOk: true }), { kind: 'ready', video: true, videoNeedsConsent: false, admin: false, max: 8, mixedClosed: false });
assert.equal(C.availability({ ...ok, video: false, mixed_closed: true }, { nativeOk: true }).mixedClosed, true, 'vidéo mixte fermée par l’enseignant');
assert.deepEqual(C.availability({ ...ok, can_join: false, reason: 'suspended' }, { nativeOk: true }), { kind: 'blocked', reason: 'suspended' });
assert.deepEqual(C.availability({ ...ok, can_join: false }, { nativeOk: true }), { kind: 'blocked', reason: 'parental' });
assert.equal(C.reasonText('rate'), 'Trop de tentatives. Réessayez dans un moment.');
assert.equal(C.reasonText('inconnu'), 'Une erreur est survenue.');
assert.equal(C.reasonText(null), 'Une erreur est survenue.');
for (const r of ['disabled', 'not_configured', 'soon', 'native']) assert.ok(C.isSoonReason(r), r);
assert.ok(!C.isSoonReason('full'));
assert.deepEqual(C.parseMeta('{"admin":true}'), { admin: true });
assert.deepEqual(C.parseMeta('{"admin":"true"}'), { admin: false });
assert.deepEqual(C.parseMeta('pas du json'), { admin: false });
assert.deepEqual(C.parseMeta(undefined), { admin: false });
const P = (o) => ({ identity: o.name, admin: false, speaking: false, micOn: true, camOn: false, local: false, ...o });
assert.deepEqual(C.orderPeople([P({ name: 'Zayd' }), P({ name: 'Amina', speaking: true }), P({ name: 'Moi', local: true }), P({ name: 'Bilal' })]).map((p) => p.name), ['Moi', 'Amina', 'Bilal', 'Zayd']);
assert.equal(C.canModerate(true, P({ name: 'x' })), true);
assert.equal(C.canModerate(false, P({ name: 'x' })), false, 'non-hôte : aucun bouton de modération');
assert.equal(C.canModerate(true, P({ name: 'x', admin: true })), false, 'un hôte ne modère pas un autre hôte');
assert.equal(C.canModerate(true, P({ name: 'x', local: true })), false);
assert.equal(C.canReport(P({ name: 'x', local: true })), false);
assert.equal(C.fmtDuration(65_000), '01:05');
assert.equal(C.fmtDuration(3_725_000), '1:02:05');
assert.equal(C.fmtDuration(-5), '00:00');

// --- livekit.ts (Edge Function, sans Deno) ---
const base = join(root, 'node_modules', '.cache');
mkdirSync(base, { recursive: true });
const dir = mkdtempSync(join(base, 'zikru-calltoken-'));
const src = readFileSync(join(root, 'supabase/functions/call-token/livekit.ts'), 'utf8');
writeFileSync(join(dir, 'livekit.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const L = await import(join(dir, 'livekit.mjs'));

const env = (o) => (k) => o[k];
assert.equal(L.readConfig(env({})), null);
assert.equal(L.readConfig(env({ LIVEKIT_URL: 'YOUR_LIVEKIT_URL', LIVEKIT_API_KEY: 'YOUR_LIVEKIT_API_KEY', LIVEKIT_API_SECRET: 'YOUR_LIVEKIT_API_SECRET' })), null, 'valeurs d’exemple → non configuré');
assert.equal(L.readConfig(env({ LIVEKIT_URL: 'ftp://x', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' })), null);
// Valeurs de test locales (pas de vraie clé).
const cfg = L.readConfig(env({ LIVEKIT_URL: 'wss://test.invalid/', LIVEKIT_API_KEY: 'test-key', LIVEKIT_API_SECRET: 'test-secret-local' }));
assert.ok(cfg);
assert.equal(L.httpUrl(cfg.url), 'https://test.invalid');
assert.equal(L.httpUrl('ws://localhost:7880'), 'http://localhost:7880');

const now = 1_800_000_000;
const jwt = await L.signJwt(cfg, { sub: 'u1' }, 600, now);
const [h, b, s] = jwt.split('.');
assert.equal(s, createHmac('sha256', 'test-secret-local').update(`${h}.${b}`).digest('base64url'), 'signature HS256 valide');
const dec = (x) => JSON.parse(Buffer.from(x, 'base64url').toString('utf8'));
assert.deepEqual(dec(h), { alg: 'HS256', typ: 'JWT' });
const body = dec(b);
assert.equal(body.iss, 'test-key');
assert.equal(body.exp - now, 600, 'durée de validité du jeton');
assert.ok(body.nbf <= now);

const room = 'family_0b6a3c1e-1111-4222-8333-444455556666';
const join0 = { ok: true, room, identity: '0b6a3c1e-aaaa-4bbb-8ccc-dddd00001111', name: 'A'.repeat(80), video: false, admin: false, max_participants: 8, token_ttl_s: 600, ring: false };
const gA = L.participantGrant(join0);
assert.deepEqual(gA.canPublishSources, ['microphone'], 'sans accord vidéo : micro seulement');
assert.equal(gA.roomRecord, false, 'jamais d’enregistrement');
assert.equal(gA.roomAdmin, false, 'jamais d’admin côté client');
assert.equal(gA.canPublishData, false, 'pas de données dans l’appel');
assert.equal(gA.canUpdateOwnMetadata, false);
assert.equal(gA.room, room);
assert.deepEqual(L.participantGrant({ ...join0, video: true }).canPublishSources, ['microphone', 'camera']);
assert.ok(!JSON.stringify(L.participantGrant({ ...join0, video: true, admin: true })).includes('screen'), 'pas de partage d’écran');
assert.equal(L.participantGrant({ ...join0, admin: true }).roomAdmin, false, 'hôte : modération via la fonction serveur uniquement');
const cl = L.participantClaims({ ...join0, admin: true });
assert.equal(cl.sub, join0.identity);
assert.equal(cl.name.length, 60);
assert.equal(cl.metadata, '{"admin":true}');
assert.ok(L.ROOM_RE.test(room));
assert.ok(!L.ROOM_RE.test('family_x'));
assert.ok(!L.ROOM_RE.test('autre_0b6a3c1e-1111-4222-8333-444455556666'));
assert.ok(L.UUID_RE.test(join0.identity));
assert.deepEqual(
  L.audioTracksToMute([
    { sid: 'TR_a', type: 'AUDIO', source: 'MICROPHONE', muted: false },
    { sid: 'TR_b', type: 'AUDIO', source: 'MICROPHONE', muted: true },
    { sid: 'TR_c', type: 'VIDEO', source: 'CAMERA', muted: false },
    { sid: '', type: 'AUDIO', source: 'MICROPHONE', muted: false },
  ]),
  ['TR_a'],
);

// Client RoomService : URL, jeton serveur limité à la salle, 404 = salle vide.
const calls = [];
const fake = async (url, init) => {
  calls.push({ url, init });
  if (url.endsWith('/ListParticipants')) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => ({ participants: [{ identity: 'x', tracks: [{ sid: 'TR_1', type: 'AUDIO', source: 'MICROPHONE' }] }] }) };
};
const rs = L.roomService(cfg, fake);
assert.deepEqual(await rs.participants(room), []);
assert.equal(calls[0].url, 'https://test.invalid/twirp/livekit.RoomService/ListParticipants');
const g0 = dec(calls[0].init.headers.Authorization.split(' ')[1].split('.')[1]);
assert.deepEqual(g0.video, { room, roomAdmin: true });
assert.ok(g0.exp - g0.nbf <= 70, 'jeton serveur court');
await rs.createRoom(room, 8);
assert.deepEqual(JSON.parse(calls[1].init.body), { name: room, max_participants: 8, empty_timeout: 120, departure_timeout: 20 });
const fail = L.roomService(cfg, async () => ({ ok: false, status: 500, json: async () => ({}) }));
await assert.rejects(fail.removeParticipant(room, 'x'), /livekit_RemoveParticipant_500/);

// --- Edge Function : aucune clé en dur, rien d'enregistré ---
const fn = readFileSync(join(root, 'supabase/functions/call-token/index.ts'), 'utf8') + src;
assert.ok(!/Egress|egress|roomRecord:\s*true|roomAdmin:\s*true,\s*canPublish/.test(fn.replace(/aucun appel Egress/g, '')), 'pas d’enregistrement ni de droit admin client');
assert.ok(!/(API|SECRET)[A-Z_]*\s*=\s*['"][A-Za-z0-9]{8,}/.test(fn), 'aucun secret en dur');

// --- Isolement : seul l'écran /call charge le module d'appel ; les SDK LiveKit/WebRTC restent dans src/components/call ---
for (const f of walk(join(root, 'src'))) {
  const rel = f.slice(root.length).replace(/\\/g, '/');
  const t = readFileSync(f, 'utf8');
  if (/from '(livekit-client|@livekit\/[\w-]+)'|require\('(livekit-client|@livekit\/)/.test(t)) assert.ok(rel.startsWith('src/components/call/'), 'SDK d’appel importé hors du module : ' + rel);
  if (/from '@\/components\/call\//.test(t) || /import\('@\/components\/call\//.test(t)) assert.ok(rel === 'src/app/call.tsx' || rel.startsWith('src/components/call/'), 'module d’appel chargé hors de /call : ' + rel);
  // Toute mention « bout en bout » doit être une réserve (« pas encore », « jamais », « ne sont pas »…), jamais une promesse.
  for (const line of t.split('\n')) if (/bout en bout/.test(line)) assert.ok(/pas encore|jamais|aucune promesse|promesse de|ne sont pas|n’est pas|n'est pas/.test(line), 'mention « bout en bout » sans réserve : ' + rel + ' : ' + line.trim().slice(0, 120));
}

console.log('test-calls OK');
