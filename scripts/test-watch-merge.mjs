// Fusion des séances Apple Watch : un identifiant ne compte qu'une fois, un total plus petit
// ne retire rien, les appuis du téléphone ne sont pas rejoués. Aucune compilation Swift ici.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = join(root, 'node_modules', '.cache');
mkdirSync(base, { recursive: true });
const dir = mkdtempSync(join(base, 'zikru-watch-'));
function emit(rel) {
  const src = readFileSync(join(root, 'src/lib', rel + '.ts'), 'utf8').replace(/from '(\.\.?\/[\w/-]+)'/g, "from '$1.mjs'");
  const out = join(dir, rel + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return out;
}
for (const r of ['tasbih-core', 'tasbih-log', 'watch-sync', 'preserve', 'durable', 'tasbih-store']) emit(r);
const L = await import(join(dir, 'tasbih-log.mjs'));
const W = await import(join(dir, 'watch-sync.mjs'));
const { createDurable } = await import(join(dir, 'durable.mjs'));
const { createTasbihStore } = await import(join(dir, 'tasbih-store.mjs'));

const read = (p) => readFileSync(join(root, p), 'utf8');
const pending = [];
const test = (name, fn) => pending.push([name, fn]);

const session = (over) => ({ id: 'w1', zikrId: 'subhanallah', count: 1, round: 33, goal: 33, at: 1, origin: 'watch', ...over });

test('le compteur montre est gratuit', () => {
  assert.equal(W.WATCH_COUNTER_IS_FREE, true);
  for (const file of ['src/lib/watch-sync.ts', 'src/lib/use-watch-sync.ts', 'src/lib/watch-bridge.ts', 'src/lib/watch-bridge.ios.ts']) {
    assert.equal(/from ['"][^'"]*premium/.test(read(file)), false, file);
  }
});

test('même séance deux fois : un seul ajout', () => {
  const doc = L.newDoc('phone');
  const a = W.mergeWatchSessions(doc, [session({ count: 4 })], () => 'p1');
  const b = W.mergeWatchSessions(a.doc, [session({ count: 4 })], () => 'p1');
  assert.equal(a.added, 4);
  assert.equal(b.added, 0);
  assert.equal(b.doc.t.count, 4);
  assert.equal(b.doc.t.total, 4);
  assert.equal(b.doc.watch.applied.w1, 4);
});

test('la séance grandit : seul l’écart est ajouté', () => {
  let doc = L.newDoc('phone');
  doc = W.mergeWatchSessions(doc, [session({ count: 10 })], () => 'p').doc;
  const next = W.mergeWatchSessions(doc, [session({ count: 15, at: 2 })], () => 'p');
  assert.equal(next.added, 5);
  assert.equal(next.doc.t.count, 15);
  assert.equal(next.doc.t.total, 15);
});

test('un total plus ancien ne retire rien', () => {
  let doc = W.mergeWatchSessions(L.newDoc('phone'), [session({ count: 15 })], () => 'p').doc;
  const next = W.mergeWatchSessions(doc, [session({ count: 10, at: 9 })], () => 'p');
  assert.equal(next.added, 0);
  assert.equal(next.doc.t.count, 15);
  assert.equal(next.doc.watch.applied.w1, 15);
});

test('deux identifiants s’additionnent, le doublon dans le même paquet non', () => {
  const doc = W.mergeWatchSessions(L.newDoc('phone'), [session({ id: 'a', count: 2 }), session({ id: 'a', count: 2, at: 2 }), session({ id: 'b', count: 3, at: 3 })], () => 'p').doc;
  assert.equal(doc.t.count, 5);
  assert.equal(doc.watch.applied.a, 2);
  assert.equal(doc.watch.applied.b, 3);
});

test('ordre inversé : on garde le plus grand total de la séance', () => {
  const lateFirst = W.mergeWatchSessions(L.newDoc('phone'), [session({ count: 15, at: 2 }), session({ count: 10, at: 1 })], () => 'p');
  const earlyFirst = W.mergeWatchSessions(L.newDoc('phone'), [session({ count: 10, at: 1 }), session({ count: 15, at: 2 })], () => 'p');
  assert.equal(lateFirst.added, 15);
  assert.equal(earlyFirst.added, 15);
  assert.equal(lateFirst.doc.t.count, earlyFirst.doc.t.count);
});

test('une séance téléphone n’est pas recomptée', () => {
  const phone = session({ id: 'phone-1', origin: 'phone', count: 40 });
  const doc = W.mergeWatchSessions(L.newDoc('phone'), [phone], () => 'p');
  assert.equal(doc.added, 0);
  assert.equal(doc.doc.t.count, 0);
  assert.equal(doc.doc.watch.applied['phone-1'], undefined);
});

test('les appuis déjà sur le téléphone restent, la montre s’y ajoute', () => {
  let doc = L.recordClicks(L.newDoc('phone'), 5, 'manuel', 1).doc;
  doc = W.mergeWatchSessions(doc, [session({ count: 4 })], () => 'p').doc;
  assert.equal(doc.t.count, 9);
  assert.equal(doc.t.total, 9);
  assert.equal(W.phoneOnlyCount(doc, () => 'x'), 5);
  const sent = W.syncPhoneSession(doc, 50, () => 'p-new');
  assert.equal(sent.session.count, 5);
  assert.equal(sent.session.origin, 'phone');
  assert.equal(sent.session.zikrId, 'subhanallah');
});

test('un autre zikr ne bouge pas le compte affiché et n’est pas perdu', () => {
  let doc = L.recordClicks(L.newDoc('phone'), 5, 'manuel', 1).doc;
  const once = W.mergeWatchSessions(doc, [session({ id: 'autre', zikrId: 'alhamdulillah', count: 8 })], () => 'p');
  assert.equal(once.added, 8);
  assert.equal(once.addedLive, 0);
  assert.equal(once.doc.t.count, 5);
  assert.equal(once.doc.t.total, 5);
  assert.equal(once.doc.t.externalTotal, 8);
  assert.equal(once.doc.t.sessions[0].id, 'autre');
  assert.equal(once.doc.t.sessions[0].count, 8);
  assert.equal(once.doc.t.sessions[0].external, true);
  assert.equal(once.doc.t.sessions[0].source, 'watch');
  const twice = W.mergeWatchSessions(once.doc, [session({ id: 'autre', zikrId: 'alhamdulillah', count: 8 })], () => 'p');
  assert.equal(twice.added, 0);
  assert.equal(twice.doc.t.externalTotal, 8);
  const grew = W.mergeWatchSessions(twice.doc, [session({ id: 'autre', zikrId: 'alhamdulillah', count: 11, at: 4 })], () => 'p');
  assert.equal(grew.added, 3);
  assert.equal(grew.doc.t.count, 5);
  assert.equal(grew.doc.t.externalTotal, 11);
  assert.equal(grew.doc.t.sessions.find((s) => s.id === 'autre').count, 11);
});

test('un alias de composition compte sur le zikr affiché', () => {
  let doc = L.newDoc('phone');
  doc = L.updateState(doc, (t) => ({ ...t, dhikrId: 'Wird · Istighfar', target: 100 }));
  const merged = W.mergeWatchSessions(doc, [session({ zikrId: 'step-1', alias: 'Wird · Istighfar', count: 6, goal: 100, round: 33 })], () => 'p');
  assert.equal(merged.addedLive, 6);
  assert.equal(merged.doc.t.count, 6);
  assert.equal(merged.doc.t.dhikrId, 'Wird · Istighfar');
});

test('paquets illisibles ou trop gros sont ignorés', () => {
  const doc = L.newDoc('phone');
  const bad = W.mergeWatchSessions(
    doc,
    [null, 'non', { id: '', zikrId: 'a', count: 3, at: 1, origin: 'watch' }, { id: 'ok', zikrId: 'subhanallah', count: -1, at: 1, origin: 'watch' }, { id: 'big', zikrId: 'subhanallah', count: 5_000_000, at: 1, origin: 'watch' }, { id: 'nope', zikrId: 'subhanallah', count: 2, at: 1, origin: 'cloud' }],
    () => 'p',
  );
  assert.equal(bad.added, 0);
  assert.equal(bad.doc.t.count, 0);
  assert.deepEqual(W.sessionsFromPayload('pas du json'), []);
  assert.deepEqual(W.sessionsFromPayload({ kind: 'catalog', today: [] }), []);
  const parsed = W.sessionsFromPayload(JSON.stringify({ v: 1, kind: 'sessions', sessions: [session({ count: 2 })] }));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].count, 2);
});

test('remise à zéro : une seule nouvelle époque, le compte téléphone repart à zéro', () => {
  let doc = L.recordClicks(L.newDoc('phone'), 10, 'manuel', 1).doc;
  doc = W.syncPhoneSession(doc, 1, () => 'p-a').doc;
  assert.equal(doc.watch.epochs.subhanallah ?? 0, 0);
  doc = L.updateState(doc, (t) => ({ ...t, count: 0, watchCount: 0 }));
  const reset = W.syncPhoneSession(doc, 2, () => 'p-b');
  assert.equal(reset.session.count, 0);
  assert.equal(reset.session.id, 'p-b');
  assert.equal(reset.doc.watch.epochs.subhanallah, 1);
  const again = W.syncPhoneSession(reset.doc, 3, () => 'p-c');
  assert.equal(again.changed, false);
  assert.equal(again.doc.watch.epochs.subhanallah, 1);
  assert.equal(again.session.id, 'p-b');
});

test('tours et vibrations', () => {
  assert.equal(W.roundFor(33), 33);
  assert.equal(W.roundFor(99), 99);
  assert.equal(W.roundFor(100), 100);
  assert.equal(W.roundFor(3), 3);
  assert.equal(W.roundFor(50), 50);
  assert.equal(W.roundFor(1000), 33);
  assert.equal(W.roundFor(0), 33);
  assert.equal(W.hapticFor(0, 1, 33, 33), 'tap');
  assert.equal(W.hapticFor(32, 33, 33, 33), 'goal');
  assert.equal(W.hapticFor(32, 33, 33, 100), 'round');
  assert.equal(W.hapticFor(99, 100, 33, 100), 'goal');
  assert.equal(W.hapticFor(10, 12, 33, 100), 'tap');
  assert.equal(W.hapticFor(31, 34, 33, 100), 'round');
  assert.equal(W.hapticFor(98, 100, 33, 100), 'goal');
});

test('catalogue : anglais ou français, arabe conservé, composition courante', () => {
  const phone = session({ id: 'p', origin: 'phone', count: 0, zikrId: 'Wird · Ya Latif' });
  const cat = W.buildCatalog({
    lang: 'ar',
    today: [{ id: 'subhanallah', ar: 'سُبْحَانَ ٱللَّٰهِ', label: 'Subḥāna-llāh', goal: 33 }],
    composition: [{ id: 'step', ar: 'يَا لَطِيفُ', label: 'Ya Latif', goal: 1000, alias: 'Wird · Ya Latif' }],
    compositionTitle: 'Wird',
    activeId: 'Wird · Ya Latif',
    phone,
    applied: {},
    epochs: {},
    now: 5,
  });
  assert.equal(cat.lang, 'fr');
  assert.equal(cat.prefer, 'composition');
  assert.equal(cat.composition[0].ar, 'يَا لَطِيفُ');
  assert.equal(cat.composition[0].round, 33);
  assert.equal(cat.composition[0].goal, 1000);
  assert.equal(cat.today[0].round, 33);
  const en = W.buildCatalog({ ...{ lang: 'en', today: cat.today, composition: [], compositionTitle: '', activeId: 'subhanallah', phone, applied: {}, epochs: {}, now: 6 } });
  assert.equal(en.lang, 'en');
  assert.equal(en.prefer, 'today');
  assert.equal(W.watchLang('de'), 'fr');
  assert.equal(W.sessionsFromPayload(cat).length, 0);
});

test('le magasin rejoue une séance reçue avant le chargement, puis l’ignore', async () => {
  const kv = new Map();
  const durable = createDurable({
    getItem: async (k) => (kv.has(k) ? kv.get(k) : null),
    setItem: async (k, v) => { kv.set(k, v); },
    removeItem: async (k) => { kv.delete(k); },
  });
  const store = createTasbihStore({ durable, key: 'tasbih', makeDev: () => 'dev1', readRetryMs: [1] });
  store.mergeWatch([session({ count: 6 })]);
  await store.load();
  await store.lastWrite();
  assert.equal(store.get().count, 6);
  assert.equal(store.get().total, 6);
  const again = store.mergeWatch([session({ count: 6 })]);
  assert.equal(again.added, 0);
  assert.equal(store.get().count, 6);
  const store2 = createTasbihStore({ durable, key: 'tasbih', makeDev: () => 'dev2', readRetryMs: [1] });
  await store2.load();
  assert.equal(store2.mergeWatch([session({ count: 6 })]).added, 0);
  assert.equal(store2.mergeWatch([session({ count: 9, at: 3 })]).added, 3);
  assert.equal(store2.get().count, 9);
});

test('les sources montrent parlent WatchConnectivity, la couronne, le hors-ligne et le logo', () => {
  const watch = ['targets/watch/CounterModel.swift', 'targets/watch/CounterView.swift', 'targets/watch/ZikruWatchApp.swift'].map(read).join('\n');
  const widget = read('targets/watch-widget/Complication.swift');
  const phone = read('modules/zikru-watch/ios/ZikruWatchModule.swift');
  for (const needle of ['WCSession', 'transferUserInfo', 'updateApplicationContext', 'digitalCrownRotation', 'isLuminanceReduced', 'WKInterfaceDevice', '0x18 / 255', '0xF7 / 255']) {
    assert.equal(watch.includes(needle), true, needle);
  }
  assert.equal(widget.includes('widgetURL'), true);
  assert.equal(widget.includes('zikru-watch://count'), true);
  assert.equal(widget.includes(watch.match(/group\.com\.vibecode\.zikru-76mpdv\.watch/)[0]), true);
  assert.equal(phone.includes('transferUserInfo'), true);
  assert.equal(phone.includes('updateApplicationContext'), true);
  assert.equal(read('targets/watch/expo-target.config.js').includes("bundleIdentifier: '.watchkitapp'"), true);
  assert.equal(read('targets/watch-widget/expo-target.config.js').includes("bundleIdentifier: '.watchkitapp.widget'"), true);
  assert.equal(read('targets/watch/expo-target.config.js').includes('assets/icon.png'), true);
  assert.equal(read('app.json').includes('"bundleIdentifier": "com.vibecode.zikru-76mpdv"'), true);
});

for (const [name, fn] of pending) {
  await fn();
  console.log('ok', name);
}
console.log(`test-watch-merge OK (${pending.length})`);
