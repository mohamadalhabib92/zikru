// Tests du compteur Bluetooth (logique pure) : transpile src/lib/ble/core.ts et src/lib/tasbih-core.ts puis teste avec node:assert.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ble-'));
async function load(rel, name) {
  const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const f = join(dir, name);
  writeFileSync(f, js);
  return import(f);
}
const c = await load('../src/lib/ble/core.ts', 'core.mjs');
const tc = await load('../src/lib/tasbih-core.ts', 'tasbih-core.mjs');

let fail = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('✓', name);
  } catch (e) {
    fail++;
    console.log('✗', name, '\n ', e.message);
  }
};
const B = (...a) => new Uint8Array(a);
const A = (s) => new Uint8Array([...s].map((x) => x.charCodeAt(0)));

test('normUuid / shortUuid', () => {
  assert.equal(c.normUuid('AE30'), '0000ae30-0000-1000-8000-00805f9b34fb');
  assert.equal(c.normUuid(0x180f), '0000180f-0000-1000-8000-00805f9b34fb');
  assert.equal(c.shortUuid('0000ae02-0000-1000-8000-00805f9b34fb'), 'ae02');
  assert.equal(c.shortUuid(c.NUS_SERVICE), c.NUS_SERVICE);
  assert.ok(c.sameUuid('2A19', '00002a19-0000-1000-8000-00805F9B34FB'));
  assert.ok(c.isValidUuid('fff0') && !c.isValidUuid('xyz'));
});
test('base64 (valeurs ble-plx)', () => {
  assert.deepEqual([...c.b64ToBytes('qgMADA==')], [0xaa, 0x03, 0x00, 0x0c]);
  assert.deepEqual([...c.b64ToBytes('')], []);
  assert.equal(c.toHex(B(0xaa, 3, 0, 12)), 'aa 03 00 0c');
});
test('décodeur BSTWSH (AA 03 00 n)', () => {
  assert.deepEqual(c.parseBstwsh(B(0xaa, 0x03, 0x00, 0x2a)), { kind: 'absolute', value: 42 });
  assert.deepEqual(c.parseBstwsh(B(0xaa, 0x03, 0x01, 0x00)), { kind: 'absolute', value: 256 });
  assert.equal(c.parseBstwsh(B(0xaa, 0x05, 0x01)), null);
});
test('décodeur iQibla (ASCII « Q07,0012,… »)', () => {
  assert.deepEqual(c.parseIqibla(A('Q07,0012,59759507,0,0')), { kind: 'absolute', value: 12 });
  assert.equal(c.parseIqibla(A('hello')), null);
  assert.deepEqual(c.parseGeneric(B(1, 2)), { kind: 'pulse' });
});
test('détection de profil', () => {
  const chars = [{ service: c.normUuid('ae30'), uuid: c.normUuid('ae02'), notify: true, read: false }];
  assert.equal(c.detectProfile('BW-1234', []).id, 'bstwsh');
  assert.equal(c.detectProfile(null, chars).id, 'bstwsh');
  assert.equal(c.detectProfile('iQIBLA Zikr', []).id, 'iqibla');
  assert.equal(c.detectProfile('Inconnu', []).id, 'generic');
});
test('services demandés au navigateur (sans HID bloqué)', () => {
  const s = c.servicesToRequest(c.profileById('auto'), ['1812', 'abcd']);
  assert.ok(s.includes(c.normUuid('ae30')) && s.includes(c.NUS_SERVICE) && s.includes(c.STD.battery) && s.includes(c.normUuid('abcd')));
  assert.ok(!s.includes(c.STD.hid));
  assert.equal(new Set(s).size, s.length);
});
test('correspondance par défaut', () => {
  const bst = [
    { service: c.normUuid('ae30'), uuid: c.normUuid('ae02'), notify: true, read: false },
    { service: c.STD.battery, uuid: c.STD.batteryLevel, notify: true, read: true },
  ];
  assert.equal(c.defaultMapping(c.profileById('bstwsh'), bst).mode, 'absolute');
  const one = [{ service: c.normUuid('fff0'), uuid: c.normUuid('fff1'), notify: true, read: false }, bst[1]];
  assert.equal(c.defaultMapping(c.profileById('generic'), one).characteristic, c.normUuid('fff1'));
  const two = [...one, { service: c.normUuid('fff0'), uuid: c.normUuid('fff2'), notify: true, read: false }];
  assert.equal(c.defaultMapping(c.profileById('generic'), two), null);
});
test('ClickDecoder absolu : base, deltas, perte, remise à zéro', () => {
  const m = { service: 'x', characteristic: 'y', mode: 'absolute', byteIndex: -1 };
  const d = new c.ClickDecoder(m, c.parseBstwsh, 1000);
  const f = (n, now = 10_000) => d.feed(B(0xaa, 3, 0, n), now);
  assert.equal(d.feed(B(0xaa, 3, 0, 40), 1200), 0, 'valeur initiale = base');
  assert.equal(f(41), 1);
  assert.equal(f(41), 0, 'doublon');
  assert.equal(f(44), 3, 'notifications perdues rattrapées');
  assert.equal(f(200), 1, 'saut aberrant plafonné');
  assert.equal(f(0), 0, 'remise à zéro');
  assert.equal(f(1), 1);
  assert.equal(f(0xff, 10_000) + 0, 1);
  assert.equal(d.feed(B(1, 2), 10_000), 0, 'trame non reconnue ignorée');
  const late = new c.ClickDecoder(m, c.parseBstwsh, 0);
  assert.equal(late.feed(B(0xaa, 3, 0, 7), 5000), 1, 'premier appui après la période de base');
});
test('ClickDecoder octet compteur + débordement', () => {
  const d = new c.ClickDecoder({ service: 'x', characteristic: 'y', mode: 'absolute', byteIndex: 1 }, c.parseGeneric, 0);
  assert.equal(d.feed(B(9, 254), 10_000), 1);
  assert.equal(d.feed(B(9, 255), 10_000), 1);
  assert.equal(d.feed(B(9, 0), 10_000), 1, '255 → 0 = +1');
  assert.equal(d.feed(B(9, 2), 10_000), 2);
});
test('ClickDecoder impulsions (signature / 2 par appui)', () => {
  const sig = new c.ClickDecoder({ service: 'x', characteristic: 'y', mode: 'pulse', pressSignature: '01' }, c.parseGeneric, 0);
  assert.equal([B(1), B(0), B(1), B(0)].reduce((a, b) => a + sig.feed(b), 0), 2);
  const two = new c.ClickDecoder({ service: 'x', characteristic: 'y', mode: 'pulse', notifsPerClick: 2 }, c.parseGeneric, 0);
  assert.equal([B(5), B(6), B(7), B(8)].reduce((a, b) => a + two.feed(b), 0), 2);
});
const S = (ch, bytes) => ({ service: c.normUuid('fff0'), characteristic: c.normUuid(ch), bytes });
test('apprentissage : 1 signal par appui, bruit ignoré', () => {
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push(S('fff1', B(0x55)));
  for (let i = 0; i < 2; i++) samples.push(S('fff4', B(i)));
  samples.push({ service: c.STD.battery, characteristic: c.STD.batteryLevel, bytes: B(80) });
  const r = c.analyzeLearn(samples, 5);
  assert.ok(r.ok);
  assert.equal(r.mapping.characteristic, c.normUuid('fff1'));
  assert.equal(r.mapping.mode, 'pulse');
});
test('apprentissage : octet compteur détecté', () => {
  const samples = [10, 11, 12, 13, 14].map((n) => S('fff1', B(0x10, n, 0x77)));
  const r = c.analyzeLearn(samples, 5);
  assert.ok(r.ok);
  assert.equal(r.mapping.mode, 'absolute');
  assert.deepEqual(r.mapping.field, { offset: 1, len: 1, endian: 'le' });
});
test('détection auto : entier 16 bits little-endian', () => {
  const f = c.detectCounterField([0x1fe, 0x1ff, 0x200].map((n) => B(0x55, n & 0xff, n >> 8, 0x00, 0x09)));
  assert.equal(f.len >= 2, true);
  assert.equal(f.endian, 'le');
  assert.equal(c.readField(B(0x55, 0x2c, 0x01, 0, 9), f), 300);
});
test('détection auto : entier 32 bits big-endian (octets de poids fort nuls)', () => {
  const f = c.detectCounterField([5, 6, 7].map((n) => B(0xaa, 0, 0, 0, n)));
  assert.deepEqual(f, { offset: 1, len: 4, endian: 'be' });
  assert.equal(c.readField(B(0xaa, 0, 1, 0, 0), f), 65536);
});
test('détection auto : nombre en ASCII (format iQibla Q07,0012,…)', () => {
  const f = c.detectCounterField(['Q07,0012,59759507,0,0', 'Q07,0013,59759507,0,0', 'Q07,0014,59759507,0,0'].map(A));
  assert.deepEqual(f, { ascii: 1 });
  assert.equal(c.readField(A('Q07,0120,1,0,0'), f), 120);
});
test('détection auto : 3 appuis suffisent (apprentissage court)', () => {
  const r = c.analyzeLearn([3, 4, 5].map((n) => S('fff1', B(0, 0, n))), 3);
  assert.ok(r.ok);
  assert.equal(r.mapping.mode, 'absolute');
});
test('synchronisation : seul le delta hors connexion est ajouté', () => {
  assert.equal(c.syncDelta(100, 130), 30);
  assert.equal(c.syncDelta(100, 100), 0);
  assert.equal(c.syncDelta(100, 7), 7); // remis à zéro puis 7 appuis
  const m = { service: 'x', characteristic: 'y', mode: 'absolute', field: { offset: 0, len: 2, endian: 'be' } };
  const d = new c.ClickDecoder(m, () => null, 0, 100);
  assert.equal(d.feed(B(0, 130), 10_000), 30);
  assert.equal(d.lastWasSync, true);
  assert.equal(d.feed(B(0, 130), 10_001), 0); // même valeur relue : pas de double comptage
  assert.equal(d.feed(B(0, 131), 10_002), 1);
  assert.equal(d.lastWasSync, false);
});
test('scan : compteurs probables reconnus par nom ou service', () => {
  assert.equal(c.likelyCounter('iQIBLA Zikr Ring').likely, true);
  assert.equal(c.likelyCounter('BW-1234').likely, true);
  assert.equal(c.likelyCounter('Smart Tasbih').likely, true);
  assert.equal(c.likelyCounter('JBL Flip 5').likely, false);
  assert.equal(c.likelyCounter(null, ['0000ae30-0000-1000-8000-00805f9b34fb']).likely, true);
});
test('apprentissage : appui + relâchement → signature', () => {
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push(S('fff1', B(1)), S('fff1', B(0)));
  const r = c.analyzeLearn(samples, 5);
  assert.ok(r.ok);
  assert.equal(r.mapping.pressSignature, '01');
});
test('apprentissage : format connu (BSTWSH)', () => {
  const samples = [1, 2, 3, 4, 5].map((n) => ({ service: c.normUuid('ae30'), characteristic: c.normUuid('ae02'), bytes: B(0xaa, 3, 0, n) }));
  const r = c.analyzeLearn(samples, 5);
  assert.ok(r.ok && r.mapping.mode === 'absolute' && r.mapping.byteIndex === -1 && r.confidence === 'haute');
});
test('apprentissage : échecs explicites', () => {
  assert.equal(c.analyzeLearn([], 5).ok, false);
  assert.equal(c.analyzeLearn([S('fff1', B(1))], 5).ok, false);
  assert.equal(c.analyzeLearn([], 1).ok, false);
});
test('touches HID', () => {
  const k = c.DEFAULT_HID_KEYS;
  assert.ok(c.isCounterKey({ key: 'Enter' }, k));
  assert.ok(c.isCounterKey({ key: 'AudioVolumeUp' }, k));
  assert.ok(!c.isCounterKey({ key: 'Enter', repeat: true }, k));
  assert.ok(!c.isCounterKey({ key: ' ', targetIsEditable: true }, k));
  assert.ok(!c.isCounterKey({ key: 'a' }, k));
  assert.ok(!c.isCounterKey({ key: 'Enter', ctrlKey: true }, k));
  assert.equal(c.keyLabel('AudioVolumeUp'), 'Volume +');
});
test('reconnexion : délais croissants puis abandon', () => {
  assert.equal(c.reconnectDelay(0), 1000);
  assert.ok(c.reconnectDelay(3) > c.reconnectDelay(2));
  assert.equal(c.reconnectDelay(99), null);
});
test('reconnexion automatique : délais plafonnés, jamais d’abandon', () => {
  assert.equal(c.keeperDelay(0), 2000);
  assert.ok(c.keeperDelay(2) > c.keeperDelay(1));
  assert.equal(c.keeperDelay(99), 60000);
  assert.equal(c.keeperDelay(1e6), 60000);
  assert.equal(c.keeperDelay(-1), 2000);
});
test('appareils mémorisés : correspondance id, nom, service', () => {
  const known = [
    { id: 'AA', name: 'BSTWSH-01', services: ['ae30'] },
    { id: 'BB', name: null, services: [c.normUuid('fff0'), c.normUuid('180f')] },
  ];
  assert.equal(c.matchKnown({ id: 'AA', name: null }, known).by, 'id');
  const byName = c.matchKnown({ id: 'ZZ', name: ' BSTWSH-01 ' }, known);
  assert.equal(byName.by, 'nom');
  assert.equal(byName.device.id, 'AA');
  const bySvc = c.matchKnown({ id: 'YY', name: null, services: ['0000fff0-0000-1000-8000-00805f9b34fb'] }, known);
  assert.equal(bySvc.by, 'service');
  assert.equal(bySvc.device.id, 'BB');
  // services génériques (batterie…) : aucune correspondance
  assert.equal(c.matchKnown({ id: 'XX', name: null, services: ['180f', '1800'] }, known), null);
  // nom différent : aucune correspondance, même service (seuls les appareils sans nom sont associés par service)
  assert.equal(c.matchKnown({ id: 'WW', name: 'Autre', services: ['ae30'] }, known), null);
});
test('tasbih : appuis, cycles 33/99/100, sessions', () => {
  let t = { count: 0, target: 33, dhikrId: 'subhanallah', total: 5, sessions: [] };
  let r = tc.applyClicks(t, 32, 'manuel');
  assert.equal(r.cycleCompleted, false);
  r = tc.applyClicks(r.next, 1, 'bluetooth');
  assert.equal(r.cycleCompleted, true);
  assert.equal(r.next.count, 33);
  assert.equal(r.next.total, 38);
  assert.equal(r.next.deviceCount, 1);
  r = tc.applyClicks({ ...r.next, target: 99 }, 70, 'bluetooth');
  assert.equal(r.cycles, 1);
  assert.equal(tc.applyClicks({ ...t, target: 0 }, 500, 'manuel').cycleCompleted, false, '∞');
  assert.equal(tc.applyClicks({ ...t, target: 100, count: 95 }, 10, 'clavier').cycles, 1);
  assert.equal(tc.applyClicks(t, 0, 'manuel').next, t);
  const closed = tc.closeSession(r.next, 's1', '2026-10-27T12:00:00Z');
  assert.equal(closed.count, 0);
  assert.equal(closed.deviceCount, 0);
  assert.equal(closed.sessions[0].count, 103);
  assert.equal(closed.sessions[0].source, 'mixte');
  const bt = tc.closeSession(tc.applyClicks(t, 3, 'bluetooth').next, 's2', 'x');
  assert.equal(bt.sessions[0].source, 'bluetooth');
  assert.equal(tc.closeSession(t, 's3', 'x'), t);
});

if (fail) {
  console.log(`\n${fail} test(s) en échec`);
  process.exit(1);
}
console.log('\nTous les tests BLE / tasbih passent.');
