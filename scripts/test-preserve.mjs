// Gardes de conservation. Chaque callback ci-dessous regroupe plusieurs asserts.
// Les JSON de fixtures/preservation sont synthétiques : ce script ne prouve aucun appareil.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = join(root, 'node_modules', '.cache');
mkdirSync(base, { recursive: true });
const dir = mkdtempSync(join(base, 'zikru-preserve-'));
function emit(rel) {
  const src = readFileSync(join(root, 'src/lib', rel + '.ts'), 'utf8').replace(/from '(\.\.?\/[\w/-]+)'/g, "from '$1.mjs'");
  const out = join(dir, rel + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
  return out;
}
for (const r of ['tasbih-core', 'tasbih-log', 'watch-sync', 'durable', 'preserve', 'tasbih-store', 'community/queue']) emit(r);
const P = await import(join(dir, 'preserve.mjs'));
const Q = await import(join(dir, 'community/queue.mjs'));
const { createDurable } = await import(join(dir, 'durable.mjs'));
const { createTasbihStore } = await import(join(dir, 'tasbih-store.mjs'));

const fixture = (name) => JSON.parse(readFileSync(join(root, 'fixtures/preservation', name), 'utf8'));
const fixtureText = (name) => readFileSync(join(root, 'fixtures/preservation', name), 'utf8');

let fail = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class FakeKV {
  constructor(init = {}) {
    this.committed = new Map(Object.entries(init));
  }
  async getItem(k) {
    await sleep(1);
    return this.committed.has(k) ? this.committed.get(k) : null;
  }
  setItem(k, v) {
    return new Promise((res) =>
      setTimeout(() => {
        this.committed.set(k, v);
        res();
      }, 1),
    );
  }
  async removeItem(k) {
    this.committed.delete(k);
  }
  kill() {
    return Object.fromEntries(this.committed);
  }
}
const KEY = '@zikru/tasbih';
let devN = 0;
const mk = (kv) => {
  const durable = createDurable(kv, { retryMs: [5, 10] });
  const store = createTasbihStore({ durable, key: KEY, makeDev: () => `dev${++devN}`, readRetryMs: [5], backupEvery: 1000 });
  return { durable, store };
};

test('file : une ligne ancienne sans attempt n’est pas fusionnée ni renumérotée', () => {
  const rows = fixture('community-queue-legacy-synthetic.json');
  const out = Q.coalesceQueue(rows, new Set(), () => {
    throw new Error('pas de nouvel identifiant');
  });
  assert.equal(out.length, 2);
  assert.equal(out.find((r) => r.client_id === 'already-maybe-sent').count, 11);
  assert.equal(out.find((r) => r.client_id === 'open-new').count, 2);
  assert.equal(out.reduce((a, r) => a + r.count, 0), 13);
});

test('file : deux clients déjà soumis gardent chacun leur identifiant et leur nombre', () => {
  const rows = [
    { goal_id: 'g', count: 5, source: 'bluetooth', client_id: 'phone-a', attempt: 1 },
    { goal_id: 'g', count: 8, source: 'bluetooth', client_id: 'phone-b', attempt: 1 },
    { goal_id: 'g', count: 1, source: 'bluetooth', client_id: 'phone-a-open', attempt: 0 },
    { goal_id: 'g', count: 2, source: 'bluetooth', client_id: 'phone-b-open', attempt: 0 },
  ];
  const out = Q.coalesceQueue(rows, new Set(), () => 'only-if-overflow');
  const frozenA = out.find((r) => r.client_id === 'phone-a');
  const frozenB = out.find((r) => r.client_id === 'phone-b');
  assert.equal(frozenA.count, 5);
  assert.equal(frozenB.count, 8);
  const open = out.filter((r) => r.attempt === 0);
  assert.equal(open.length, 1);
  assert.equal(open[0].client_id, 'phone-a-open');
  assert.equal(open[0].count, 3);
  assert.equal(out.reduce((a, r) => a + r.count, 0), 16);
});

test('file : seal fige le nombre, un nouvel appui part dans une autre ligne', () => {
  let rows = [{ goal_id: 'g', count: 4, source: 'manuel', client_id: 'c9', attempt: 0, member_id: null, note: 'x' }];
  rows = Q.sealAttempts(rows, ['c9']);
  assert.equal(rows[0].attempt, 1);
  assert.equal(rows[0].count, 4);
  assert.equal(rows[0].note, 'x');
  const out = Q.coalesceQueue([...rows, { goal_id: 'g', count: 6, source: 'manuel', client_id: 'c10', attempt: 0, note: 'y' }], new Set(), () => 'n');
  assert.equal(out.find((r) => r.client_id === 'c9').count, 4);
  assert.equal(out.find((r) => r.client_id === 'c10').count, 6);
  assert.equal(out.find((r) => r.client_id === 'c10').note, 'y');
});

test('file : un autre compte ou un propriétaire inconnu ne reçoit pas la ligne', () => {
  const rows = [
    { goal_id: 'famille', count: 10, source: 'manuel', client_id: 'a1', attempt: 1, owner: 'compte-a' },
    { goal_id: 'famille', count: 4, source: 'manuel', client_id: 'legacy', attempt: 1 },
    { goal_id: 'cercle', count: 2, source: 'manuel', client_id: 'b1', attempt: 0, owner: 'compte-b' },
  ];
  const asB = Q.partitionByOwner(rows, 'compte-b');
  assert.deepEqual(asB.mine.map((r) => r.client_id), ['b1']);
  assert.equal(asB.held.find((r) => r.client_id === 'a1').count, 10);
  assert.equal(asB.held.find((r) => r.client_id === 'legacy').owner, undefined);
  const merged = Q.coalesceQueue(
    [
      { goal_id: 'g', count: 3, source: 'manuel', client_id: 'a', attempt: 0, owner: 'compte-a' },
      { goal_id: 'g', count: 5, source: 'manuel', client_id: 'b', attempt: 0, owner: 'compte-b' },
    ],
    new Set(),
    () => {
      throw new Error('pas de fusion entre comptes');
    },
  );
  assert.equal(merged.length, 2);
  assert.equal(merged.find((r) => r.owner === 'compte-a').count, 3);
  assert.equal(merged.find((r) => r.owner === 'compte-b').count, 5);
});

test('objectifs : plusieurs liens sans choix ne reçoivent pas les appuis, un seul lien oui', () => {
  const two = [{ goalId: 'famille' }, { goalId: 'cercle' }];
  assert.deepEqual(Q.autoShareTargets(two).map((l) => l.goalId), []);
  assert.deepEqual(Q.autoShareTargets([{ goalId: 'famille', focused: true }, { goalId: 'cercle' }]).map((l) => l.goalId), ['famille']);
  assert.deepEqual(Q.autoShareTargets([{ goalId: 'seul' }]).map((l) => l.goalId), ['seul']);
  const legacy = [{ goalId: 'ancien-a' }, { goalId: 'ancien-b' }];
  assert.equal(Q.autoShareTargets(legacy).length, 0);
});

test('partage : rien n’est envoyé tant que le mode n’est pas connu, ni si le choix est « nothing »', () => {
  assert.equal(Q.shareAllowsSend(undefined, false), false);
  assert.equal(Q.shareAllowsSend('nothing', true), false);
  assert.equal(Q.shareAllowsSend(undefined, true), true);
  assert.equal(Q.shareAllowsSend('counter', true), true);
});

test('file : 23505 retire la ligne, une autre erreur la garde', () => {
  const rows = [{ goal_id: 'g', count: 9, source: 'manuel', client_id: 'c', attempt: 1 }];
  assert.equal(Q.classifyContributionError({ code: '23505', message: 'duplicate key value violates unique constraint' }), 'already-stored');
  assert.equal(Q.classifyContributionError({ code: '42501', message: 'new row violates row-level security policy' }), 'keep');
  assert.equal(Q.ackAttempts(rows, ['c']).length, 0);
  assert.equal(Q.ackAttempts(rows, []).length, 1);
  assert.equal(Q.ackAttempts(rows, [])[0].count, 9);
});

test('réglages : la forme 1.0.29 synthétique garde ses clés, le défaut comble le reste', () => {
  const stored = fixture('settings-1.0.29-shape-synthetic.json');
  const merged = P.mergeKeepingStored({ lang: 'fr', adhanVoice: 'default', onboarded: false }, stored);
  assert.equal(merged.hijriCalendar, 'ummAlQura');
  assert.equal(merged.prayer.mosque.enabled, true);
  assert.equal(merged.quietHoursLabel, 'synthetic-only');
  assert.equal(merged.adhanVoice, 'default');
  assert.equal(merged.lang, 'fr');
});

test('programme : extras du cache synthétique survivent à une réécriture', () => {
  const raw = fixture('program-progress-1.0.29-shape-synthetic.json');
  const read = P.readProgramProgress(raw);
  assert.equal(read.counts['step-a'], 33);
  assert.deepEqual(read.dirty, ['step-a']);
  assert.equal(read.extras.clientNote, 'synthetic');
  assert.deepEqual(read.extras.attemptIds, ['p-1']);
  const again = P.readProgramProgress(P.writeProgramProgress({ ...read, counts: { ...read.counts, 'step-a': 34 } }));
  assert.equal(again.counts['step-a'], 34);
  assert.equal(again.extras.clientNote, 'synthetic');
  const kept = P.saveProgramProgress(raw, { 'step-a': 40 }, ['step-a']);
  assert.equal(kept.counts['step-a'], 40);
  assert.equal(kept.clientNote, 'synthetic');
  assert.deepEqual(kept.attemptIds, ['p-1']);
  assert.deepEqual(again.extras.attemptIds, ['p-1']);
});

test('export : brut conservé, format futur non applicable, ce n’est pas une sauvegarde d’appareil', () => {
  const text = fixtureText('tasbih-v3-future-synthetic.json');
  const doc = P.buildLocalExport([{ key: 'tasbih', raw: text }, { key: 'broken', raw: '{truncated' }], '1.0.26');
  assert.equal(doc.deviceBackup, false);
  assert.equal(doc.formatVersion, 1);
  assert.equal(doc.entries[0].raw, text);
  const seen = P.assessLocalExport(doc);
  assert.equal(seen.applicable, true);
  assert.deepEqual(seen.keys, ['tasbih', 'broken']);
  const future = P.assessLocalExport({ ...doc, formatVersion: 2, entries: [{ key: 'tasbih', raw: text }] });
  assert.equal(future.applicable, false);
  assert.equal(future.futureFormat, true);
  assert.deepEqual(future.keys, ['tasbih']);
});

test('tasbih v2 synthétique : un champ inconnu reste après un appui', async () => {
  const text = fixtureText('tasbih-v2-extra-synthetic.json');
  const kv = new FakeKV({ [KEY]: text });
  const { durable, store } = mk(kv);
  await store.load();
  assert.equal(store.holdingNewer(), false);
  assert.equal(store.get().total, 7);
  store.addClicks(1, 'manuel');
  await durable.flush();
  const saved = JSON.parse(kv.committed.get(KEY));
  assert.equal(saved.shrine, 'unknown-field');
  assert.equal(saved.log[0].extraMark, 'keep');
  assert.equal(saved.t.total, 8);
  assert.equal(saved.v, 2);
});

test('tasbih v3 synthétique : la clé n’est pas réécrite, l’appui va dans l’inbox', async () => {
  const text = fixtureText('tasbih-v3-future-synthetic.json');
  const kv = new FakeKV({ [KEY]: text });
  const { durable, store } = mk(kv);
  await store.load();
  assert.equal(store.holdingNewer(), true);
  assert.equal(store.get().total, 14);
  store.addClicks(3, 'manuel');
  await durable.flush();
  assert.equal(kv.committed.get(KEY), text);
  const inbox = JSON.parse(kv.committed.get(KEY + '.inbox'));
  assert.equal(inbox.items.reduce((a, it) => a + it.n, 0), 3);
  const kv2 = new FakeKV(kv.kill());
  const { store: again } = mk(kv2);
  await again.load();
  assert.equal(again.holdingNewer(), true);
  assert.equal(again.get().total, 17);
  assert.equal(kv2.committed.get(KEY), text);
  assert.equal(JSON.parse(kv2.committed.get(KEY)).futureNote, 'do-not-rewrite');
});

test('tasbih v1 synthétique : copie .v1 intacte, total repris', async () => {
  const text = fixtureText('tasbih-v1-synthetic.json');
  const kv = new FakeKV({ [KEY]: text });
  const { durable, store } = mk(kv);
  await store.load();
  await durable.flush();
  assert.deepEqual(JSON.parse(kv.committed.get(KEY + '.v1')), JSON.parse(text));
  assert.equal(store.get().total, 40);
  assert.equal(JSON.parse(kv.committed.get(KEY)).v, 2);
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
  console.log(`\n${fail} callback(s) en échec`);
  process.exit(1);
}
console.log(`\nConservation : ${tests.length} callbacks OK (plusieurs asserts chacun). Fixtures synthétiques, pas un export d’appareil.`);
