// Tests de la pagination de Médine (604 p.), des juz’ / hizb, des sajdas, des références et du texte uthmani embarqué.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'pages-'));
const load = (name) => {
  const src = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8').replace(/from '\.\/(\w[\w-]*)'/g, "from './$1.mjs'");
  writeFileSync(join(dir, name + '.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
};
for (const n of ['surahs', 'quran-meta', 'quran-nav', 'quran-uthmani', 'recitation']) load(n);
const N = await import(join(dir, 'quran-nav.mjs'));
const U = await import(join(dir, 'quran-uthmani.mjs'));
const R = await import(join(dir, 'recitation.mjs'));
let ok = 0;
const test = (n, f) => { f(); ok++; console.log('✓', n); };

test('index global ↔ (sourate, verset)', () => {
  assert.equal(N.gIndex(1, 1), 0);
  assert.equal(N.gIndex(114, 6), 6235);
  assert.deepEqual(N.fromIndex(N.gIndex(2, 255)), [2, 255]);
  for (const i of [0, 6, 7, 293, 6235]) assert.equal(N.gIndex(...N.fromIndex(i)), i);
});
test('pages de Médine : repères connus', () => {
  assert.equal(N.pageOf(1, 1), 1);
  assert.equal(N.pageOf(1, 7), 1);
  assert.equal(N.pageOf(2, 1), 2);
  assert.equal(N.pageOf(2, 6), 3);
  assert.equal(N.pageOf(2, 255), 42);
  assert.equal(N.pageOf(18, 1), 293);
  assert.equal(N.pageOf(36, 1), 440);
  assert.equal(N.pageOf(67, 1), 562);
  assert.equal(N.pageOf(114, 6), 604);
  assert.deepEqual(N.pageRange(1), [0, 7]);
  assert.deepEqual(N.pageRange(604), [N.gIndex(112, 1), 6236]);
  let sum = 0;
  for (let p = 1; p <= 604; p++) { const [a, b] = N.pageRange(p); assert.ok(b > a); sum += b - a; }
  assert.equal(sum, 6236);
});
test('juz’, hizb, rub‘ et manzil', () => {
  assert.equal(N.juzOfIndex(N.gIndex(2, 141)), 1);
  assert.equal(N.juzOfIndex(N.gIndex(2, 142)), 2);
  assert.equal(N.juzPage(30), 582);
  assert.equal(N.juzOfIndex(6235), 30);
  assert.equal(N.hizbOfIndex(0), 1);
  assert.equal(N.hizbOfIndex(6235), 60);
  assert.deepEqual(N.hizbRange(1), [0, N.gIndex(2, 75)]);
  assert.equal(N.rubStartAt(N.gIndex(2, 26)), 2);
  assert.equal(N.rubLabel(2), '¼ Hizb 1');
  assert.equal(N.rubLabel(5), 'Hizb 2');
  assert.equal(N.manzilOfIndex(N.gIndex(5, 1)), 2);
});
test('15 sajdas (7:206, 96:19 obligatoire)', () => {
  assert.equal(N.sajdaAt(N.gIndex(7, 206)), 0);
  assert.equal(N.sajdaAt(N.gIndex(96, 19)), 1);
  assert.equal(N.sajdaAt(N.gIndex(2, 255)), -1);
});
test('références tapées', () => {
  assert.deepEqual(N.parseRef('2:255'), { kind: 'ayah', s: 2, a: 255 });
  assert.deepEqual(N.parseRef(' 18 10 '), { kind: 'ayah', s: 18, a: 10 });
  assert.equal(N.parseRef('2:287'), null);
  assert.deepEqual(N.parseRef('p 50'), { kind: 'page', p: 50 });
  assert.deepEqual(N.parseRef('page 604'), { kind: 'page', p: 604 });
  assert.deepEqual(N.parseRef('juz 30'), { kind: 'juz', j: 30 });
  assert.deepEqual(N.parseRef('Hizb 60'), { kind: 'hizb', h: 60 });
  assert.deepEqual(N.parseRef('36'), { kind: 'surah', s: 36 });
  assert.deepEqual(N.parseRef('٢:٢٥٥'), { kind: 'ayah', s: 2, a: 255 });
  assert.equal(N.parseRef('rahman'), null);
  assert.equal(N.arNum(286), '٢٨٦');
});
test('texte uthmani Tanzil verbatim : 6236 versets, copyright, marques ۩ et ۞', () => {
  const lines = U.QURAN_UTHMANI.split('\n').filter((l) => l && l[0] !== '#');
  assert.equal(lines.length, 6236);
  assert.ok(U.QURAN_UTHMANI.includes('Tanzil Quran Text (Uthmani, Version 1.1)') && U.QURAN_UTHMANI.includes('CHANGING IT IS NOT ALLOWED'));
  assert.equal((U.QURAN_UTHMANI.match(/۩/g) || []).length, 15);
  assert.ok(lines[N.gIndex(2, 255)].startsWith('2|255|') && lines[N.gIndex(2, 255)].replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').replace(/\u0671/g, '\u0627').includes('الحى القيوم'));
});
test('audio : URL EveryAyah, secours Islamic Network, file répétée', () => {
  assert.equal(R.ayahUrl(R.reciterById('alafasy'), 2, 5), 'https://everyayah.com/data/Alafasy_128kbps/002005.mp3');
  assert.equal(R.ayahFallbackUrl(R.reciterById('alafasy'), 2, 255), 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/262.mp3');
  assert.equal(R.ayahFallbackUrl(R.reciterById('warsh-dosary'), 1, 1), null);
  const q = R.buildQueue([[1, 1], [1, 2]], 3, 2);
  assert.equal(q.length, 12);
  assert.deepEqual(q.slice(0, 4).map((x) => [x.a, x.rep, x.pass]), [[1, 1, 1], [1, 2, 1], [1, 3, 1], [2, 1, 1]]);
  assert.equal(R.gapMs('x1', 4.2), 4200);
});
console.log(`pages : ${ok} tests OK`);
