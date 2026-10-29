// Tests « aucun appui perdu » : journal du compteur, écritures durables, magasin du tasbih, migration,
// arrêt brutal simulé, rafales Bluetooth, stockage en échec, file des contributions, état partagé.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = join(root, 'node_modules', '.cache');
mkdirSync(base, { recursive: true });
const dir = mkdtempSync(join(base, 'zikru-durable-'));
/** Transpile src/lib/<rel>.ts vers dir/<rel>.mjs (imports relatifs → .mjs). */
function emit(rel) {
  const src = readFileSync(join(root, 'src/lib', rel + '.ts'), 'utf8').replace(/from '(\.\.?\/[\w/-]+)'/g, "from '$1.mjs'");
  const out = join(dir, rel + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
  return out;
}
for (const r of ['tasbih-core', 'tasbih-log', 'durable', 'tasbih-store', 'ble/core', 'community/queue', 'shared-state']) emit(r);
// stockage simulé pour shared-state.ts
writeFileSync(
  join(dir, 'storage.mjs'),
  `export const mem = new Map(); export const writes = [];
export async function loadJSON(k, fb) { await new Promise((r) => setTimeout(r, 5)); return mem.has(k) ? JSON.parse(mem.get(k)) : fb; }
export async function saveJSON(k, v) { writes.push(k); mem.set(k, JSON.stringify(v)); return true; }
const subs = new Set(); export function onStorageCleared(f) { subs.add(f); return () => subs.delete(f); }`,
);
const imp = (r) => import(join(dir, r + '.mjs'));
const L = await imp('tasbih-log');
const { createDurable } = await imp('durable');
const { createTasbihStore } = await imp('tasbih-store');
const core = await imp('ble/core');
const { coalesceQueue } = await imp('community/queue');
const S = await imp('shared-state');
const stor = await imp('storage');

let fail = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stockage clé/valeur simulé : lent, en échec à la demande, et « tuable » (seules les écritures terminées restent). */
class FakeKV {
  constructor(init = {}) {
    this.committed = new Map(Object.entries(init));
    this.delay = 0;
    this.failWrites = false;
    this.failReads = 0;
    this.inflight = new Map();
    this.maxInflight = 0;
    this.setCalls = 0;
  }
  async getItem(k) {
    await sleep(1);
    if (this.failReads > 0) {
      this.failReads--;
      throw new Error('lecture indisponible');
    }
    return this.committed.has(k) ? this.committed.get(k) : null;
  }
  setItem(k, v) {
    this.setCalls++;
    const n = (this.inflight.get(k) ?? 0) + 1;
    this.inflight.set(k, n);
    this.maxInflight = Math.max(this.maxInflight, n);
    return new Promise((res, rej) =>
      setTimeout(() => {
        this.inflight.set(k, this.inflight.get(k) - 1);
        if (this.failWrites) return rej(new Error('QuotaExceededError: stockage plein'));
        this.committed.set(k, v);
        res();
      }, this.delay),
    );
  }
  async removeItem(k) {
    this.committed.delete(k);
  }
  /** Arrêt brutal : on ne garde que ce qui est réellement écrit à cet instant. */
  kill() {
    return Object.fromEntries(this.committed);
  }
}
const KEY = '@zikru/tasbih';
let devN = 0;
const mk = (kv, extra = {}) => {
  const durable = createDurable(kv, { retryMs: [5, 10, 20] });
  return { durable, store: createTasbihStore({ durable, key: KEY, makeDev: () => `dev${++devN}`, readRetryMs: [5, 10], ...extra }) };
};
const stored = (kv, k = KEY) => JSON.parse(kv.committed.get(k));
/** Invariants d'un document : total dérivé du journal, séquences uniques et croissantes. */
function checkDoc(d) {
  assert.equal(d.v, 2);
  assert.equal(d.t.total, d.base + d.log.reduce((a, e) => a + e.n, 0), 'total = base + journal');
  const ids = d.log.map((e) => e.i);
  assert.equal(new Set(ids).size, ids.length, 'séquences uniques');
  for (let i = 1; i < ids.length; i++) assert.ok(ids[i] > ids[i - 1], 'séquences croissantes');
  if (ids.length) assert.ok(d.seq >= ids[ids.length - 1]);
}

// ------------------------------------------------------------------ journal pur
test('journal : total dérivé, séquence croissante, compaction sans perte', () => {
  let d = L.newDoc('A');
  for (let k = 0; k < L.LOG_MAX + 50; k++) d = L.recordClicks(d, 2, 'manuel', 1000 + k).doc;
  assert.equal(d.t.total, 2 * (L.LOG_MAX + 50));
  assert.equal(d.log.length, L.LOG_MAX);
  assert.equal(d.base, 100);
  assert.equal(d.seq, L.LOG_MAX + 50);
  checkDoc(d);
});
test('journal : setTasbih ne peut pas modifier le total (seuls les appuis le font)', () => {
  let d = L.recordClicks(L.newDoc('A'), 5, 'manuel', 1).doc;
  d = L.updateState(d, (t) => ({ ...t, total: 0, count: 0, target: 99 }));
  assert.equal(d.t.total, 5);
  assert.equal(d.t.count, 0);
  assert.equal(d.t.target, 99);
});
test('journal : n invalide ignoré (0, négatif, NaN)', () => {
  const d0 = L.newDoc('A');
  for (const n of [0, -3, NaN, Infinity * 0]) assert.equal(L.recordClicks(d0, n, 'manuel', 1).added, 0);
});
test('fusion idempotente des journaux (synchronisation future)', () => {
  let a = L.newDoc('A');
  let b = L.newDoc('B');
  for (let k = 0; k < 5; k++) a = L.recordClicks(a, 1, 'manuel', 10 + k).doc;
  for (let k = 0; k < 3; k++) b = L.recordClicks(b, 2, 'bluetooth', 12 + k).doc;
  const m = L.mergeLogs(a.log, b.log);
  assert.equal(L.sumLog(m), 11);
  assert.deepEqual(L.mergeLogs(m, a.log, b.log, m), m, 'rejouer ne compte rien de plus');
  assert.deepEqual(L.mergeLogs(b.log, a.log), m, 'ordre indifférent');
});

// ------------------------------------------------------------------ migration
const V1 = {
  count: 17,
  target: 33,
  dhikrId: 'astaghfirullah',
  total: 12345,
  deviceCount: 4,
  sessions: [
    { id: 's1', dhikrId: 'subhanallah', count: 33, target: 33, at: '2026-10-01T10:00:00.000Z', source: 'manuel', deviceCount: 0 },
    { id: 's2', dhikrId: 'alhamdulillah', count: 99, target: 99, at: '2026-10-02T10:00:00.000Z', source: 'mixte', deviceCount: 50 },
  ],
  extra: 'champ inconnu conservé',
};
test('migration pure v1 → v2 : tous les champs conservés', () => {
  const d = L.migrate(structuredClone(V1), () => 'D');
  assert.deepEqual(d.t, V1);
  assert.equal(d.base, 12345);
  assert.equal(d.seq, 0);
  assert.equal(d.migratedFrom, 1);
  checkDoc(d);
  // idempotente : relire un v2 ne change rien
  const again = L.migrate(JSON.parse(JSON.stringify(d)), () => 'X');
  assert.deepEqual(again.t, d.t);
  assert.equal(again.dev, 'D');
});
test('migration : v2 avec total enregistré > journal (réparation sans perte)', () => {
  const d = L.migrate({ v: 2, dev: 'D', seq: 3, base: 10, log: [{ dev: 'D', i: 3, n: 2, s: 'manuel', a: 1, d: 'x' }], ble: {}, t: { ...V1, total: 20 } }, () => 'X');
  assert.equal(d.t.total, 20);
  checkDoc(d);
});
test('migration magasin : ancienne clé lue, copie « .v1 » intacte, rechargement idempotent', async () => {
  const kv = new FakeKV({ [KEY]: JSON.stringify(V1) });
  const { store, durable } = mk(kv);
  await store.load();
  await durable.flush();
  assert.deepEqual(store.get(), V1);
  assert.deepEqual(JSON.parse(kv.committed.get(KEY + '.v1')), V1, 'original conservé');
  const d = stored(kv);
  assert.equal(d.v, 2);
  assert.deepEqual(d.t, V1);
  // ajout d'appuis puis rechargement
  store.addClicks(3, 'manuel');
  await durable.flush();
  const { store: s2, durable: d2 } = mk(new FakeKV(kv.kill()));
  await s2.load();
  await d2.flush();
  assert.equal(s2.get().total, 12348);
  assert.equal(s2.get().count, 20);
  assert.deepEqual(s2.get().sessions, V1.sessions);
  assert.deepEqual(JSON.parse(kv.committed.get(KEY + '.v1')), V1, 'la copie .v1 n’est jamais réécrite');
});
test('migration : rien d’enregistré → compteur neuf', async () => {
  const kv = new FakeKV();
  const { store } = mk(kv);
  await store.load();
  assert.equal(store.get().total, 0);
  assert.equal(store.get().target, 33);
});

// ------------------------------------------------------------------ écritures durables
test('appuis rapides : 1000 appuis, jamais deux écritures concurrentes, regroupées, rien perdu', async () => {
  const kv = new FakeKV();
  kv.delay = 3;
  const { store, durable } = mk(kv);
  await store.load();
  for (let k = 0; k < 1000; k++) store.addClicks(1, 'manuel');
  assert.equal(store.get().total, 1000, 'mémoire immédiate');
  assert.ok(await durable.flush());
  assert.equal(kv.maxInflight, 1, 'écritures sérialisées par clé');
  assert.ok(kv.setCalls < 50, `écritures regroupées (${kv.setCalls})`);
  assert.equal(stored(kv).t.total, 1000);
  assert.equal(stored(kv).t.count, 1000);
  checkDoc(stored(kv));
});
test('arrêt brutal pendant une écriture : état cohérent, aucun appui confirmé perdu', async () => {
  for (let trial = 0; trial < 40; trial++) {
    const kv = new FakeKV();
    kv.delay = 1 + (trial % 4);
    const { store } = mk(kv);
    await store.load();
    let confirmed = 0;
    const killAfter = 5 + trial * 7;
    for (let k = 0; k < killAfter; k++) {
      store.addClicks(1, k % 3 ? 'manuel' : 'bluetooth');
      const total = store.get().total;
      void store.lastWrite().then((ok) => ok && (confirmed = Math.max(confirmed, total)));
      if (k % 5 === 0) await sleep(1);
    }
    await sleep(trial % 3); // l'arrêt tombe au milieu d'écritures en cours
    const disk = kv.kill();
    const confirmedAtKill = confirmed; // les confirmations arrivées après l'arrêt ne comptent pas
    const { store: s2 } = mk(new FakeKV(disk));
    await s2.load();
    const t = s2.get().total;
    assert.ok(t >= confirmedAtKill, `essai ${trial} : ${t} ≥ ${confirmedAtKill} confirmés`);
    assert.ok(t <= killAfter, 'jamais plus que les appuis faits');
    if (disk[KEY]) checkDoc(JSON.parse(disk[KEY]));
  }
});
test('écriture déchirée (fichier tronqué) : copie .corrupt conservée, reprise depuis .bak, alerte visible', async () => {
  const kv = new FakeKV();
  const { store, durable } = mk(kv);
  await store.load();
  store.addClicks(40, 'manuel');
  await store.flush(); // écrit aussi la sauvegarde .bak
  store.addClicks(2, 'manuel');
  await durable.flush();
  const disk = kv.kill();
  const torn = disk[KEY].slice(0, disk[KEY].length >> 1);
  disk[KEY] = torn;
  const kv2 = new FakeKV(disk);
  const { store: s2, durable: d2 } = mk(kv2);
  await s2.load();
  await d2.flush();
  assert.equal(s2.get().total, 40, 'reprise depuis la sauvegarde');
  assert.equal(kv2.committed.get(KEY + '.corrupt'), torn, 'contenu illisible conservé');
  assert.ok(d2.issues().some((i) => i.op === 'read' && i.key === KEY), 'alerte visible');
  checkDoc(stored(kv2));
});
test('appuis avant la fin du chargement : rejoués, jamais écrasés (H2)', async () => {
  const kv = new FakeKV({ [KEY]: JSON.stringify(V1) });
  kv.delay = 2;
  const { store, durable } = mk(kv);
  const p = store.load();
  store.addClicks(1, 'manuel');
  store.addClicks(2, 'clavier');
  store.set((t) => ({ ...t, target: 99 }));
  assert.equal(kv.setCalls, 0, 'aucune écriture avant lecture');
  await p;
  await durable.flush();
  assert.equal(store.get().total, 12348);
  assert.equal(store.get().count, 20);
  assert.equal(store.get().target, 99);
  assert.equal(stored(kv).t.total, 12348);
});
test('lecture impossible au démarrage : aucune écriture par-dessus, nouvel essai, appuis rejoués', async () => {
  const kv = new FakeKV({ [KEY]: JSON.stringify(V1) });
  kv.failReads = 3;
  const { store, durable } = mk(kv);
  const p = store.load();
  store.addClicks(5, 'manuel');
  await sleep(8);
  assert.equal(JSON.parse(kv.committed.get(KEY)).total, 12345, 'données intactes tant qu’elles ne sont pas lues');
  await p;
  await durable.flush();
  assert.equal(store.get().total, 12350);
});
test('stockage plein : erreur signalée (pas silencieuse), appuis gardés puis enregistrés au retour', async () => {
  const kv = new FakeKV();
  const { store, durable } = mk(kv);
  await store.load();
  kv.failWrites = true;
  for (let k = 0; k < 10; k++) store.addClicks(1, 'manuel');
  assert.equal(await store.lastWrite(), false, 'échec remonté à l’appelant');
  assert.ok(durable.issues().some((i) => i.op === 'write' && /plein/.test(i.message)), 'alerte visible');
  assert.equal(store.get().total, 10, 'appuis gardés en mémoire');
  kv.failWrites = false;
  await sleep(60); // nouvel essai automatique
  assert.equal(stored(kv).t.total, 10);
  assert.equal(durable.issues().length, 0, 'alerte levée');
});
test('durable : une valeur plus ancienne n’écrase jamais une plus récente ; valeur figée à l’appel', async () => {
  const kv = new FakeKV();
  kv.delay = 2;
  const d = createDurable(kv, { retryMs: [5] });
  const o = { n: 1 };
  void d.write('k', o);
  o.n = 999; // mutation après coup : sans effet sur la valeur écrite
  void d.write('k', { n: 2 });
  void d.write('k', { n: 3 });
  assert.ok(await d.flush('k'));
  assert.deepEqual(JSON.parse(kv.committed.get('k')), { n: 3 });
  assert.equal(kv.maxInflight, 1);
  assert.equal(kv.setCalls, 2, 'la valeur intermédiaire est sautée');
});
test('durable : cancelAll (effacement des données) abandonne les écritures en attente', async () => {
  const kv = new FakeKV();
  kv.delay = 5;
  const d = createDurable(kv);
  void d.write('a', 1);
  void d.write('a', 2);
  d.cancelAll();
  await sleep(15);
  assert.ok(kv.committed.get('a') !== '2', 'la valeur en attente n’est pas recréée');
});

// ------------------------------------------------------------------ Bluetooth
test('rafale Bluetooth répétée (même valeur absolue) : comptée une seule fois', async () => {
  const kv = new FakeKV();
  const { store, durable } = mk(kv);
  await store.load();
  assert.equal(store.addClicks(3, 'bluetooth', { id: 'RING', value: 43 }).added, 3);
  for (let k = 0; k < 5; k++) assert.equal(store.addClicks(3, 'bluetooth', { id: 'RING', value: 43 }).duplicate, true);
  assert.equal(store.addClicks(1, 'bluetooth', { id: 'RING', value: 44 }).added, 1);
  await durable.flush();
  assert.equal(stored(kv).t.total, 4);
  assert.equal(stored(kv).ble.RING, 44, 'curseur enregistré avec le compte');
});
test('arrêt brutal après des appuis Bluetooth : la reconnexion ne recompte rien (M2)', async () => {
  const kv = new FakeKV();
  const { store, durable } = mk(kv);
  await store.load();
  const m = { service: 'x', characteristic: 'y', mode: 'absolute', byteIndex: -1 };
  const frame = (v) => new Uint8Array([0xaa, 3, 0, v]);
  const dec = new core.ClickDecoder(m, core.parseBstwsh, 0, null);
  dec.feed(frame(40), 0); // base
  store.setCursor({ id: 'RING', value: dec.lastValue });
  for (let v = 41; v <= 50; v++) {
    const n = dec.feed(frame(v), 10_000 + v * 100);
    store.addClicks(n, 'bluetooth', { id: 'RING', value: dec.lastValue });
  }
  await durable.flush();
  // arrêt brutal : l'ancienne mémoire du Bluetooth (200 ms) n'a pas été écrite, seul le magasin compte
  const { store: s2 } = mk(new FakeKV(kv.kill()));
  await s2.load();
  assert.equal(s2.get().total, 10);
  const again = new core.ClickDecoder(m, core.parseBstwsh, 0, s2.cursor('RING') ?? null);
  const n = again.feed(frame(50), 99_000);
  assert.equal(n, 0, 'aucun double comptage à la reconnexion');
  // appuis faits sur la bague app fermée : rattrapés exactement
  const again2 = new core.ClickDecoder(m, core.parseBstwsh, 0, s2.cursor('RING') ?? null);
  assert.equal(again2.feed(frame(57), 99_000), 7);
});
test('saut de valeur en cours de connexion : accepté s’il est physiquement possible (H7)', () => {
  assert.equal(core.plausibleJump(5, 0), 5);
  assert.equal(core.plausibleJump(25, 2000), 25, '25 appuis en 2 s : possible');
  assert.equal(core.plausibleJump(25, 100), core.MAX_JUMP + 1, 'trop rapide : plafonné');
  assert.equal(core.plausibleJump(500, 60_000), 1, 'aberrant : 1');
  const m = { service: 'x', characteristic: 'y', mode: 'absolute', byteIndex: -1 };
  const d = new core.ClickDecoder(m, core.parseBstwsh, 0, null);
  const f = (v, at) => d.feed(new Uint8Array([0xaa, 3, 0, v]), at);
  f(10, 0);
  assert.equal(f(11, 5000), 1);
  assert.equal(f(41, 8000), 30, '30 trames perdues en 3 s : rattrapées');
  assert.equal(f(41, 8001), 0, 'doublon');
});

// ------------------------------------------------------------------ file des contributions (M3)
test('file des contributions : regroupement sans perte, envois en cours intacts', () => {
  const rows = [];
  for (let k = 0; k < 1500; k++) rows.push({ goal_id: k % 2 ? 'g1' : 'g2', count: 1, source: 'manuel', client_id: 'c' + k, member_id: null });
  let id = 0;
  const out = coalesceQueue(rows, new Set(['c0', 'c1']), () => 'n' + id++);
  assert.equal(out.reduce((a, r) => a + r.count, 0), 1500, 'aucun appui perdu');
  assert.ok(out.length <= 4);
  assert.ok(out.some((r) => r.client_id === 'c0') && out.some((r) => r.client_id === 'c1'));
});

// ------------------------------------------------------------------ état partagé (H2 dans shared-state)
test('shared() : une modification avant chargement est rejouée sur la valeur enregistrée', async () => {
  stor.mem.set('marks', JSON.stringify({ bookmarks: ['2:255'], notes: {} }));
  const s = S.shared('marks', { bookmarks: [], notes: {} });
  s.set((m) => ({ ...m, bookmarks: [...m.bookmarks, '1:1'] }));
  await s.load();
  assert.deepEqual(s.get().bookmarks, ['2:255', '1:1'], 'marque-page existant conservé');
  assert.deepEqual(JSON.parse(stor.mem.get('marks')).bookmarks, ['2:255', '1:1']);
});

for (const [name, fn] of tests) {
  try {
    await fn();
    console.log('✓', name);
  } catch (e) {
    fail++;
    console.log('✗', name, '\n ', e.stack ?? e.message);
  }
}
if (fail) {
  console.log(`\n${fail} test(s) en échec`);
  process.exit(1);
}
console.log('\nCompteur durable : tous les tests passent.');
