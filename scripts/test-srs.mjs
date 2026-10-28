// Tests de la révision espacée (SM-2) et de la file sabaq / sabqi / manzil.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'srs-'));
const load = (name) => {
  const src = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8').replace(/from '\.\/(\w[\w-]*)'/g, "from './$1.mjs'");
  writeFileSync(join(dir, name + '.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
};
for (const n of ['dates', 'srs']) load(n);
const S = await import(join(dir, 'srs.mjs'));
const D = await import(join(dir, 'dates.mjs'));
let ok = 0;
const test = (n, f) => { f(); ok++; console.log('✓', n); };

test('dates : addDays / daysBetween (fin de mois, bissextile, changement d’heure)', () => {
  assert.equal(D.addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(D.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(D.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(D.daysBetween('2026-03-28', '2026-03-30'), 2);
});
test('SM-2 : facile → 1, 6, puis × facteur', () => {
  let c = S.review(undefined, 'easy', '2026-01-01');
  assert.deepEqual([c.r, c.i, c.d], [1, 1, '2026-01-02']);
  c = S.review(c, 'easy', '2026-01-02');
  assert.deepEqual([c.r, c.i, c.d], [2, 6, '2026-01-08']);
  c = S.review(c, 'easy', '2026-01-08');
  assert.equal(c.r, 3);
  assert.ok(c.i >= 16 && c.i <= 19, String(c.i));
  assert.ok(c.e > 2.5);
});
test('SM-2 : moyen allonge moins, facteur réduit', () => {
  let c = S.review(undefined, 'medium', '2026-01-01');
  c = S.review(c, 'medium', '2026-01-02');
  assert.equal(c.i, 3);
  c = S.review(c, 'medium', '2026-01-05');
  assert.ok(c.i < 9 && c.i >= 4, String(c.i));
  assert.ok(c.e < 2.5);
});
test('SM-2 : difficile = oubli → révision demain, série remise à 0, facteur ≥ 1,3', () => {
  let c = S.review(undefined, 'easy', '2026-01-01');
  c = S.review(c, 'easy', '2026-01-02');
  c = S.review(c, 'hard', '2026-01-08');
  assert.deepEqual([c.r, c.i, c.d, c.x], [0, 1, '2026-01-09', 1]);
  for (let k = 0; k < 20; k++) c = S.review(c, 'hard', '2026-01-09');
  assert.equal(c.e, 1.3);
});
test('statuts : en cours / à réviser / mémorisé', () => {
  const today = '2026-02-01';
  assert.equal(S.cardStatus(undefined, today), 'none');
  assert.equal(S.cardStatus(S.newCard(today), today), 'learning');
  assert.equal(S.cardStatus(S.newCard('2026-01-30'), today), 'review');
  const due = { ...S.newCard('2026-01-01'), r: 2, i: 6, l: '2026-01-20', d: '2026-01-26' };
  assert.equal(S.cardStatus(due, today), 'review');
  const mature = { ...due, i: 30, d: '2026-02-20' };
  assert.equal(S.cardStatus(mature, today), 'memorised');
  const r = S.rangeStatus({ 0: mature, 1: mature, 2: mature }, 0, 3, today);
  assert.equal(r.status, 'memorised');
  assert.equal(S.rangeStatus({ 0: mature, 1: due }, 0, 3, today).status, 'review');
  assert.equal(S.rangeStatus({ 0: mature }, 0, 3, today).status, 'learning');
  assert.equal(S.rangeStatus({}, 0, 3, today).status, 'none');
});
test('file du jour : sabaq / sabqi / manzil, plafond du manzil, déjà révisés exclus', () => {
  const today = '2026-03-10';
  const cards = {
    10: S.newCard(today),
    11: S.newCard(today),
    20: { ...S.newCard('2026-03-01'), r: 2, i: 6, l: '2026-03-03', d: '2026-03-09' },
    21: { ...S.newCard('2026-03-01'), r: 2, i: 6, l: '2026-03-04', d: '2026-03-20' },
    30: { ...S.newCard('2025-12-01'), r: 5, i: 40, l: '2026-01-20', d: '2026-03-01' },
    31: { ...S.newCard('2025-12-01'), r: 5, i: 40, l: '2026-01-29', d: '2026-03-10' },
    32: { ...S.newCard('2025-12-01'), r: 5, i: 40, l: today, d: '2026-04-19' },
  };
  const q = S.dailyQueue(cards, today);
  assert.deepEqual(q, { sabaq: [10, 11], sabqi: [20], manzil: [30, 31] });
  assert.deepEqual(S.dailyQueue(cards, today, 1).manzil, [30]);
  assert.equal(S.queueSize(q), 5);
  assert.deepEqual(S.toRanges([5, 3, 4, 9, 10, 1]), [[1, 2], [3, 6], [9, 11]]);
});
console.log(`srs : ${ok} tests OK`);
