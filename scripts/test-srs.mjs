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

const { loadLib } = await import('./load-lib.mjs');
const { 'hifz-wave': W, 'learn-games': G } = await loadLib(['hifz-wave', 'learn-games'], 'hifz-wave');
const storeSrc = readFileSync(new URL('../src/lib/quran-store.ts', import.meta.url), 'utf8');
const waveSrc = readFileSync(new URL('../src/lib/hifz-wave.ts', import.meta.url), 'utf8');

test('plan : prochaine leçon, rythme, effacer ne touche pas les cartes', () => {
  const today = '2026-11-23';
  const plan = { scope: { kind: 'surah', surah: 1 }, perDay: 5 };
  assert.deepEqual(W.nextLesson({}, plan, today), { surah: 1, from: 1, to: 5 });
  const cards = { 0: S.newCard(today), 1: S.newCard(today), 2: S.newCard(today) };
  const keysBefore = Object.keys(cards);
  assert.deepEqual(W.nextLesson(cards, { ...plan, perDay: 4 }, today), { surah: 1, from: 4, to: 7 });
  const rush = { scope: { kind: 'surah', surah: 1 }, perDay: 3, deadline: '2026-11-25' };
  assert.equal(W.lessonCount(4, today, rush), 2);
  assert.equal(W.lessonCount(40, today, { ...plan, deadline: '2026-11-24' }), 20);
  assert.equal(W.clampDaily(1), 3);
  assert.equal(W.clampDaily(9), 5);
  assert.equal(W.DEFAULT_DAILY, 5);
  assert.equal(W.clearedPlan(), null);
  assert.deepEqual(Object.keys(cards), keysBefore);
  assert.equal(W.sanitizePlan({ scope: { kind: 'nope' } }), null);
  assert.equal(waveSrc.includes('be-games-deck'), false);
});

test('oubli et déjà su : seule la plage, forme { r, i, e, d, f, l, x }', () => {
  const today = '2026-11-23';
  const keep = S.newCard('2026-01-01');
  const old = { ...S.newCard('2026-01-01'), r: 2, i: 6, e: 2.4, x: 1, l: '2026-01-02', d: '2026-01-08' };
  const cards = { 0: old, 5: keep };
  const forgotten = W.forgetRange(cards, 0, 1);
  assert.equal(forgotten[0], undefined);
  assert.equal(forgotten[5], keep);
  const known = W.markKnownRange(cards, 0, 1, today);
  assert.equal(known[5], keep);
  assert.equal(known[0].i, S.MATURE);
  assert.equal(known[0].r, 2);
  assert.equal(known[0].e, 2.4);
  assert.equal(known[0].x, 1);
  assert.equal(known[0].f, old.f);
  assert.equal(known[0].l, old.l);
  assert.equal(known[0].d, '2026-12-14');
  const mature = { ...old, i: 30, d: '2026-12-01' };
  assert.equal(W.markKnownCard(mature, today), mature);
  const fresh = W.markKnownCard(undefined, today);
  assert.deepEqual(Object.keys(fresh).sort(), ['d', 'e', 'f', 'i', 'l', 'r', 'x']);
  assert.equal(fresh.r, 0);
  assert.equal(fresh.x, 0);
  assert.equal(fresh.i, 21);
  assert.match(storeSrc, /delete n\[i\]/);
  assert.match(storeSrc, /if \(!n\[i\]\) n\[i\] = newCard/);
});

test('rappel actif : échus puis leçon, verset suivant, série avec un jour de grâce', () => {
  const today = '2026-11-23';
  const due = { ...S.newCard('2026-11-01'), r: 1, i: 1, e: 2.5, d: '2026-11-22', f: '2026-11-01', l: '2026-11-21', x: 0 };
  const studied = { ...S.newCard(today), l: today, r: 1, i: 1, d: '2026-11-24' };
  assert.deepEqual(W.recallKeys({ 4: studied, 1: due }, today, [4, 1, 9]), [1, 4, 9]);
  const puzzle = W.nextVersePuzzle('بسم الله الرحمن', 'الحمد لله رب العالمين', ['الحمد لله رب العالمين', 'الرحمن الرحيم ملك', 'مالك يوم الدين'], G.rng(2));
  assert.equal(puzzle.answer, 'الحمد لله رب العالمين');
  assert.ok(puzzle.options.includes(puzzle.answer));
  assert.ok(puzzle.options.some((x) => x !== puzzle.answer));
  const drill = W.buildDrill(0, 'الحمد لله رب العالمين', null, ['الرحمن الرحيم'], G.rng(3));
  assert.equal(drill.kind, 'order');
  assert.equal(G.gradeOf(0, false), 'easy');
  assert.equal(G.gradeOf(2, false), 'medium');
  assert.equal(G.gradeOf(0, true), 'hard');
  assert.equal(W.practiceCounts({ 1: due }, today), false);
  assert.equal(W.practiceCounts({ 1: { ...due, l: today, d: '2026-11-30' } }, today), true);
  assert.equal(W.practiceCounts({}, today), false);
  let st = W.notePractice(null, '2026-11-20');
  st = W.notePractice(st, '2026-11-22');
  assert.equal(st.n, 2);
  st = W.notePractice(st, '2026-11-25');
  assert.equal(st.n, 1);
  assert.equal(W.shownStreak({ last: '2026-11-21', n: 4 }, today), 4);
  assert.equal(W.shownStreak({ last: '2026-11-20', n: 4 }, today), 0);
});

console.log(`srs : ${ok} tests OK`);
