// Bague pendant que l’écran compteur est ouvert : le chiffre affiché est tasbih.count
// (useSyncExternalStore → tasbihStore.get), le même que le doigt via addClicks.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = join(root, 'node_modules', '.cache');
mkdirSync(base, { recursive: true });
const dir = mkdtempSync(join(base, 'zikru-ring-'));
function emit(rel) {
  const src = readFileSync(join(root, 'src/lib', rel + '.ts'), 'utf8').replace(/from '(\.\.?\/[\w/-]+)'/g, "from '$1.mjs'");
  const out = join(dir, rel + '.mjs');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return out;
}
for (const r of ['tasbih-core', 'tasbih-log', 'watch-sync', 'preserve', 'durable', 'tasbih-store', 'ble/core']) emit(r);
const c = await import(join(dir, 'ble/core.mjs'));
const { createDurable } = await import(join(dir, 'durable.mjs'));
const { createTasbihStore } = await import(join(dir, 'tasbih-store.mjs'));

const pending = [];
const test = (name, fn) => pending.push([name, fn]);
const B = (...a) => new Uint8Array(a);
const ABS = { service: 'x', characteristic: 'y', mode: 'absolute', byteIndex: -1 };

function openStore() {
  const kv = new Map();
  const durable = createDurable({
    getItem: async (k) => (kv.has(k) ? kv.get(k) : null),
    setItem: async (k, v) => {
      kv.set(k, v);
    },
    removeItem: async (k) => {
      kv.delete(k);
    },
  });
  const store = createTasbihStore({ durable, key: 'tasbih', makeDev: () => 'phone', readRetryMs: [1] });
  return store;
}

/** Ce que l’écran compteur affiche : le compte du magasin, pas un état local. */
const shown = (store) => store.get().count;

/**
 * Une notification, comme le gestionnaire puis DataProvider :
 * décodeur → addClicks (le même que le doigt) → mémorisation du curseur absolu.
 */
function ringNotify(store, decoder, deviceId, bytes, now) {
  const before = shown(store);
  const n = decoder.feed(bytes, now);
  const cursor = c.clickCursor('absolute', decoder.lastEvent, deviceId, decoder.lastValue);
  const r = n > 0 ? store.addClicks(n, 'bluetooth', cursor) : { added: 0, cycleCompleted: false };
  if (decoder.lastValue != null) store.setCursor({ id: deviceId, value: decoder.lastValue });
  return { n, added: r.added, cycle: r.cycleCompleted, before, after: shown(store), zikr: store.get().dhikrId, cursor };
}

test('l’écran compteur lit le magasin, le doigt et la bague passent par addClicks', () => {
  const screen = readFileSync(join(root, 'src/app/(tabs)/tasbih.tsx'), 'utf8');
  const data = readFileSync(join(root, 'src/lib/data.tsx'), 'utf8');
  assert.match(screen, /\{tasbih\.count\}/);
  assert.equal(/useState\([^)]*count/.test(screen), false, 'pas de compte local que seul le doigt mettrait à jour');
  assert.match(screen, /increment\(\)/);
  assert.match(data, /const increment = \(\) => addClicks\(1, 'manuel'\)/);
  assert.match(data, /bleCounter\.onClicks\(\(n, src, cursor\) => addClicks\(/);
});

test('clic de bague, écran compteur ouvert : +1 par clic, y compris en rafale', async () => {
  const store = openStore();
  await store.load();
  store.set((t) => ({ ...t, dhikrId: 'subhanallah', target: 33, count: 0 }));
  assert.equal(shown(store), 0);
  const decoder = new c.ClickDecoder(ABS, c.parseBstwsh, 0);
  const frame = B(0xaa, 3, 0, 1);
  assert.equal(ringNotify(store, decoder, 'ring-1', frame, 80).after, 0, 'référence de connexion');
  const first = ringNotify(store, decoder, 'ring-1', frame, c.BASELINE_GRACE_MS + 20);
  assert.equal(first.added, 1);
  assert.equal(first.after, 1);
  assert.equal(first.zikr, 'subhanallah');
  assert.equal(first.cursor, undefined, 'la valeur figée ne part pas comme curseur');
  let last = shown(store);
  for (let i = 0; i < 30; i++) {
    const step = ringNotify(store, decoder, 'ring-1', frame, c.BASELINE_GRACE_MS + 40 + i * 10);
    assert.equal(step.after, last + 1, `clic rapide ${i}`);
    last = step.after;
  }
  assert.equal(shown(store), 31);
  const finger = store.addClicks(1, 'manuel');
  assert.equal(finger.added, 1);
  assert.equal(shown(store), 32, 'le doigt continue le même compte');
  const goal = ringNotify(store, decoder, 'ring-1', frame, c.BASELINE_GRACE_MS + 5000);
  assert.equal(goal.cycle, true, 'même completion d’objectif que le doigt');
  assert.equal(shown(store), 33);
  assert.equal(store.get().externalTotal ?? 0, 0, 'l’appui n’est pas parti dans le total montre');
  const phone = store.notePhone(9_000);
  assert.equal(store.mergeWatch([phone]).added, 0, 'rejouer la séance téléphone ne jette pas les clics de la bague');
  assert.equal(shown(store), 33);
});

test('trame sans total (profil absolu) : le chiffre affiché avance, le curseur ne l’avale pas', async () => {
  const store = openStore();
  await store.load();
  store.set((t) => ({ ...t, dhikrId: 'alhamdulillah', target: 99 }));
  const decoder = new c.ClickDecoder(ABS, c.parseIqibla, 0);
  for (let i = 0; i < 8; i++) {
    const step = ringNotify(store, decoder, 'ring-2', B(0x01), 1000 + i * 12);
    assert.equal(step.after, i + 1);
    assert.equal(step.zikr, 'alhamdulillah');
  }
  store.setCursor({ id: 'ring-2', value: 1 });
  const eaten = store.addClicks(1, 'bluetooth', { id: 'ring-2', value: 1 });
  assert.equal(eaten.added, 0, 'curseur déjà vu : le journal refuse l’appui');
  assert.equal(shown(store), 8, 'le chiffre affiché ne bouge pas si on repasse le curseur');
  const kept = store.addClicks(1, 'bluetooth');
  assert.equal(kept.added, 1);
  assert.equal(shown(store), 9);
});

test('compteur absolu qui avance : +1, répétition ignorée, même chiffre que le doigt', async () => {
  const store = openStore();
  await store.load();
  const decoder = new c.ClickDecoder(ABS, c.parseBstwsh, 1_000);
  const fr = (n) => B(0xaa, 3, 0, n);
  assert.equal(ringNotify(store, decoder, 'ring-3', fr(40), 1_200).after, 0);
  assert.equal(ringNotify(store, decoder, 'ring-3', fr(41), 10_000).after, 1);
  assert.equal(ringNotify(store, decoder, 'ring-3', fr(41), 10_040).after, 1, 'même total : pas un deuxième appui');
  assert.equal(ringNotify(store, decoder, 'ring-3', fr(44), 10_200).after, 4, 'trois appuis manqués rattrapés');
  store.addClicks(1, 'manuel');
  assert.equal(shown(store), 5);
});

let fail = 0;
for (const [name, fn] of pending) {
  try {
    await fn();
    console.log('✓', name);
  } catch (e) {
    fail++;
    console.log('✗', name, '\n ', e instanceof Error ? e.message : e);
  }
}
if (fail) {
  console.log(fail, 'échec(s)');
  process.exit(1);
}
console.log(pending.length, 'tests bague / compteur affiché');
