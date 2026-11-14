// Présets du compteur : textes figés, rien d’écrasé, la bague compte sur le même chiffre.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { content: C, 'tasbih-preset-ar': A } = await loadLib(['content', 'tasbih-preset-ar'], 'presets');
const { AYAHS: imran } = await import('../src/lib/quran-sura/s003.ts');
const { AYAHS: anbiya } = await import('../src/lib/quran-sura/s021.ts');

const hasb = imran[172].slice(imran[172].indexOf('حَسْبُنَا'));
let yunus = anbiya[86].slice(anbiya[86].indexOf('لَّا'));
assert.equal(yunus.codePointAt(1), 0x0651, 'la chadda de liaison est dans le verset Tanzil');
yunus = yunus[0] + yunus.slice(2);

assert.equal(A.HASBUNALLAH_AR, hasb, 'ḥasbunallāh recopié du Tanzil, sans le reste du verset');
assert.equal(A.DUA_YUNUS_AR, yunus, 'dua de Yûnus : glyphes Tanzil, sans la chadda de « an »');
assert.ok(A.SALAT_FATIHA_AR.includes('الْفَاتِحِ') && A.SALAT_FATIHA_AR.includes('وَالْخَاتِمِ'));
assert.equal(A.SALAT_FATIHA_AR.includes('صَحْب'), false, 'le texte tijani standard n’ajoute pas « wa ṣaḥbihi »');

const ids = C.TASBIH_PRESETS.map((p) => p.id);
assert.deepEqual(ids, ['salat-fatih', 'hasbunallah', 'dua-yunus']);
for (const p of C.TASBIH_PRESETS) {
  assert.equal(p.status, 'approved');
  assert.equal(p.seedExample, undefined);
  assert.ok(p.translations.fr && p.translations.en && p.translations.de && p.translations.ar);
  assert.ok(p.targets[0] === p.defaultCount);
  assert.ok(Math.max(...p.targets) > p.defaultCount, 'on peut viser plus haut que la cible de départ');
}
assert.equal(C.TASBIH_PRESETS[0].defaultCount, 100);
assert.deepEqual(C.TASBIH_PRESETS[1].targets.slice(0, 2), [70, 100]);
assert.equal(C.TASBIH_PRESETS[2].defaultCount, 41);

const old = {
  id: 'hasbuna',
  kind: 'dua',
  arabic: 'حَسْبُنَا ٱللَّٰهُ وَنِعْمَ ٱلْوَكِيلُ',
  translations: {},
  source: 'ancien',
  status: 'in_review',
  seedExample: true,
  updatedAt: '2020-01-01T00:00:00.000Z',
};
const custom = { ...C.TASBIH_PRESETS[0], arabic: 'نص المستخدم', translations: { fr: 'le mien' } };
const merged = C.mergePresets([old, custom]);
assert.equal(merged[0], old, 'la fiche déjà là n’est pas remplacée');
assert.equal(merged[1].arabic, 'نص المستخدم');
assert.equal(merged.find((x) => x.id === 'hasbunallah').arabic, A.HASBUNALLAH_AR);
assert.equal(merged.find((x) => x.id === 'dua-yunus').defaultCount, 41);
assert.equal(C.mergePresets(merged), merged, 'un second passage n’ajoute rien');

const { createDurable } = await loadLib(['durable'], 'presets-d').then((m) => m.durable);
const { createTasbihStore } = await loadLib(['tasbih-store'], 'presets-s').then((m) => m['tasbih-store']);
const kv = new Map();
const store = createTasbihStore({
  durable: createDurable({
    getItem: async (k) => (kv.has(k) ? kv.get(k) : null),
    setItem: async (k, v) => {
      kv.set(k, v);
    },
    removeItem: async (k) => {
      kv.delete(k);
    },
  }),
  key: 'tasbih',
  makeDev: () => 'phone',
  readRetryMs: [1],
});
await store.load();
store.set((t) => ({ ...t, dhikrId: 'salat-fatih', target: 100, count: 0 }));
for (let i = 0; i < 3; i++) {
  const r = store.addClicks(1, 'bluetooth');
  assert.equal(r.added, 1);
  assert.equal(store.get().count, i + 1);
  assert.equal(store.get().dhikrId, 'salat-fatih');
}
store.set((t) => ({ ...t, count: 99 }));
const goal = store.addClicks(1, 'bluetooth');
assert.equal(goal.cycleCompleted, true, 'la bague déclenche le même palier que le doigt');
assert.equal(store.get().count, 100, 'le compte ne s’arrête pas : il atteint la cible et peut continuer');
store.addClicks(1, 'manuel');
assert.equal(store.get().count, 101);

console.log('test-tasbih-presets OK');
