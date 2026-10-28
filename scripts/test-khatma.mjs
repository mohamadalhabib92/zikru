// Tests du planificateur de khatma et de la série de lecture.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'khatma-'));
const load = (name) => {
  const src = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8').replace(/from '\.\/(\w[\w-]*)'/g, "from './$1.mjs'");
  writeFileSync(join(dir, name + '.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
};
for (const n of ['dates', 'khatma']) load(n);
const K = await import(join(dir, 'khatma.mjs'));
let ok = 0;
const test = (n, f) => { f(); ok++; console.log('✓', n); };

test('30 jours : ~20 pages / jour réparties régulièrement, wird du jour 1 = p. 1–20, fin prévue', () => {
  const k = K.newKhatma('2026-11-01', 30);
  assert.equal(K.pagesPerDay(k), 21);
  const s = K.khatmaStatus(k, '2026-11-01');
  assert.deepEqual(s.today, { from: 1, to: 20 });
  assert.equal(s.end, '2026-11-30');
  assert.equal(s.delta, -20);
  let covered = 0;
  for (let d = 0; d < 30; d++) { const t = K.khatmaStatus(k, `2026-11-${String(d + 1).padStart(2, '0')}`).today; assert.ok(t.to >= t.from); covered += t.to - t.from + 1; }
  assert.equal(covered, 604);
  assert.equal(s.needPerDay, 21);
});
test('jour 3, 50 pages lues : wird p. 41–60, 10 pages faites aujourd’hui, retard 10', () => {
  const k = { ...K.newKhatma('2026-11-01', 30), done: 50 };
  const s = K.khatmaStatus(k, '2026-11-03');
  assert.equal(s.day, 3);
  assert.deepEqual(s.today, { from: 41, to: 60 });
  assert.equal(s.todayDone, 10);
  assert.equal(s.delta, -10);
  assert.equal(s.nextPage, 51);
  assert.equal(s.daysLeft, 28);
  assert.equal(s.needPerDay, Math.ceil(554 / 28));
});
test('dernier jour : le wird va jusqu’à la p. 604 ; après la date prévue, tout le reste', () => {
  const k = { ...K.newKhatma('2026-11-01', 30), done: 500 };
  assert.equal(K.khatmaStatus(k, '2026-11-30').today.to, 604);
  assert.deepEqual(K.khatmaStatus(k, '2026-12-05').today, { from: 501, to: 604 });
  assert.equal(K.khatmaStatus(k, '2026-12-05').daysLeft, 1);
  assert.equal(K.khatmaStatus(k, '2026-12-05').needPerDay, 104);
});
test('khatma depuis la page 300, en 7 jours', () => {
  const k = K.newKhatma('2026-11-01', 7, 300);
  assert.equal(K.khatmaTotal(k), 305);
  assert.equal(K.pagesPerDay(k), 44);
  assert.deepEqual(K.khatmaStatus(k, '2026-11-02').today, { from: 343, to: 386 });
  assert.equal(K.khatmaStatus(k, '2026-11-07').today.to, 604);
});
test('markPage : ne recule jamais, termine la khatma', () => {
  let k = K.newKhatma('2026-11-01', 10);
  k = K.markPage(k, 30, '2026-11-01');
  assert.equal(k.done, 30);
  assert.equal(K.markPage(k, 12, '2026-11-01'), k);
  k = K.markPage(k, 604, '2026-11-09');
  assert.equal(k.finished, '2026-11-09');
  const s = K.khatmaStatus(k, '2026-11-09');
  assert.ok(s.finished && s.today === null && s.progress === 1);
});
test('série de lecture : en cours, interrompue, record', () => {
  const d = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-12'];
  assert.deepEqual(K.streak(d, '2026-10-12'), { current: 3, best: 4, todayDone: true });
  assert.deepEqual(K.streak(d, '2026-10-13'), { current: 3, best: 4, todayDone: false });
  assert.deepEqual(K.streak(d, '2026-10-14'), { current: 0, best: 4, todayDone: false });
  assert.deepEqual(K.streak([], '2026-10-14'), { current: 0, best: 0, todayDone: false });
});
console.log(`khatma : ${ok} tests OK`);
