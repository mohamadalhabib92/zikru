// Tests du Coran hors-ligne : texte Tanzil embarqué, index sans diacritiques, recherche arabe / référence / traduction.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'quran-'));
const load = (name) => {
  const src = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8')
    .replace(/from '\.\/(\w[\w-]*)'/g, "from './$1.mjs'")
    .replace(/import\('\.\/(\w[\w-]*)'\)/g, "import('./$1.mjs')");
  writeFileSync(join(dir, name + '.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
};
for (const n of ['surahs', 'quran-text', 'quran', 'quran-offline']) load(n);
writeFileSync(join(dir, 'storage.mjs'), 'export const loadJSON = async (k, f) => f; export const saveJSON = async () => true; export const saveCacheJSON = async () => {};');
writeFileSync(join(dir, 'text-cache.mjs'), 'const m = new Map(); export const readText = async (k) => m.get(k) ?? null; export const writeText = async (k, v) => { m.set(k, v); };');
const Q = await import(join(dir, 'quran-offline.mjs'));
const T = await import(join(dir, 'quran-text.mjs'));
const tests = [];
const test = (n, f) => tests.push([n, f]);

test('6236 versets, copyright Tanzil conservé', async () => {
  const { verses } = await Q.loadArabic();
  assert.equal(verses.length, 6236);
  assert.ok(T.QURAN_TEXT.includes('Tanzil Project') && T.QURAN_TEXT.includes('Creative Commons Attribution 3.0'));
  assert.equal(Q.verseIndex(114, 6), 6235);
  assert.deepEqual([verses[Q.verseIndex(2, 255)].s, verses[Q.verseIndex(2, 255)].a], [2, 255]);
});
test('basmala retirée du verset 1 (sauf al-Fātiḥa)', async () => {
  const { verses } = await Q.loadArabic();
  assert.equal(Q.normAr(verses[Q.verseIndex(2, 1)].ar), 'الم');
  assert.ok(Q.normAr(verses[0].ar).startsWith('بسم'));
});
test('arabe sans diacritiques : Āyat al-Kursī', async () => {
  const r = await Q.searchVerses('الله لا إله إلا هو الحي القيوم', 'fr.hamidullah');
  assert.ok(r.hits.some((h) => h.s === 2 && h.a === 255), JSON.stringify(r.hits.slice(0, 3).map((h) => [h.s, h.a])));
  assert.ok(r.hits.some((h) => h.s === 3 && h.a === 2));
});
test('arabe vocalisé = non vocalisé', async () => {
  const a = await Q.searchVerses('قُلْ هُوَ اللَّهُ أَحَدٌ', 'x');
  const b = await Q.searchVerses('قل هو الله احد', 'x');
  assert.deepEqual(a.hits.map((h) => [h.s, h.a]), b.hits.map((h) => [h.s, h.a]));
  assert.deepEqual([a.hits[0].s, a.hits[0].a], [112, 1]);
});
test('référence 2:255 et plage 1:1-7', async () => {
  assert.deepEqual((await Q.searchVerses('2:255', 'x')).hits.map((h) => h.a), [255]);
  assert.equal((await Q.searchVerses('1:1-7', 'x')).hits.length, 7);
  assert.equal((await Q.searchVerses('115:1', 'x')).hits.length, 0);
});
test('latin sans traduction en cache → aucun résultat, signalé', async () => {
  const r = await Q.searchVerses('patience', 'fr.hamidullah');
  assert.equal(r.translated, false);
  assert.equal(r.hits.length, 0);
});
test('traduction téléchargée (simulée) → recherche FR sans accents', async () => {
  const lines = Array.from({ length: 6236 }, (_, i) => `verset ${i}`);
  lines[Q.verseIndex(2, 153)] = 'Ô les croyants ! Cherchez secours dans l’endurance et la Salât.';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: { surahs: [{ ayahs: lines.map((text) => ({ text })) }] } }) });
  await Q.downloadTranslation('fr.test');
  const r = await Q.searchVerses('ENDURANCE salat', 'fr.test');
  assert.equal(r.translated, true);
  assert.deepEqual(r.hits.map((h) => [h.s, h.a]), [[2, 153]]);
  assert.ok(r.hits[0].tr.includes('endurance'));
});
test('lecture hors-ligne d’une sourate', async () => {
  const s = await Q.offlineSurah(112, 'fr.test');
  assert.equal(s.length, 4);
  assert.equal(s[0].n, 1);
});

let fail = 0;
for (const [n, f] of tests) {
  try {
    await f();
    console.log('✓', n);
  } catch (e) {
    fail++;
    console.log('✗', n, '→', e.message);
  }
}
if (fail) process.exit(1);
console.log(`Coran hors-ligne : ${tests.length} tests passent.`);
