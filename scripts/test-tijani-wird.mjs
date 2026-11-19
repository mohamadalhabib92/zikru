// Intégrité des wirds tijani : drapeaux « à vérifier », sources, nombres, progression guidée, Premium.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { tijani: T, 'tijani-guide': G, 'premium-flags': P } = await loadLib(['tijani', 'tijani-guide', 'premium-flags'], 'wird');

const issues = T.reviewIssues();
assert.deepEqual(issues, [], issues.join(' | '));

for (const f of Object.values(T.FORMULAS)) {
  assert.equal(f.review, 'à vérifier', f.id);
  assert.ok(f.ar.trim().length > 0, f.id);
  assert.ok(f.sources.length > 0, f.id);
  assert.ok(f.sources.every((s) => s.ref && s.note), f.id);
}
for (const p of T.PRACTICES) {
  assert.equal(p.review, 'à vérifier', p.id);
  assert.ok(p.sources.length > 0, p.id);
  for (const s of p.steps) assert.equal(s.review, 'à vérifier', p.id + s.formula);
}

const wird = G.guideSteps(T.PRACTICES.find((p) => p.id === 'wird'));
assert.deepEqual(wird.map((s) => [s.formula, s.reps, s.uncounted]), [
  ['fatiha', 1, false],
  ['istighfar', 100, false],
  ['fatih', 100, false],
  ['hailala', 100, false],
  ['closing', 1, false],
]);
const waz = G.guideSteps(T.PRACTICES.find((p) => p.id === 'wazifa'));
assert.deepEqual(waz.map((s) => s.reps), [1, 30, 50, 100, 12]);
const hay = G.guideSteps(T.PRACTICES.find((p) => p.id === 'hailala'));
assert.equal(hay[1].uncounted, true);
assert.equal(hay[1].reps, 0);
assert.ok(hay[1].todos.some((t) => t.includes('1000')));
assert.ok(waz[4].todos.some((t) => t.includes('11')));
assert.ok(!wird.some((s) => s.formula === 'jawhara'));

const burst = G.advanceGuide(wird, { step: 0, count: 0 }, 1);
assert.equal(burst.state.step, 1);
assert.equal(burst.state.count, 0);
assert.deepEqual(burst.completed, [0]);
const mid = G.advanceGuide(wird, { step: 1, count: 40 }, 70);
assert.equal(mid.state.step, 2);
assert.equal(mid.state.count, 10);
assert.deepEqual(mid.completed, [1]);
const prog = G.guideProgress(wird, mid.state.step, mid.state.count);
assert.equal(prog.total, 1 + 100 + 100 + 100 + 1);
assert.equal(prog.done, 1 + 100 + 10);

const free = G.advanceGuide(hay, { step: 1, count: 0 }, 1600);
assert.equal(free.state.step, 1, 'la haylala sans nombre n’avance pas seule');
assert.equal(free.state.count, 1600);
assert.equal(free.finished, false);
const end = G.completeUncounted(hay, free.state);
assert.equal(end.finished, true);

assert.equal(P.featureEnabled(null, 'themes'), false);
assert.equal(P.featureEnabled({ themes: false }, 'themes'), false);
assert.equal(P.featureEnabled({ themes: 'true' }, 'themes'), false);
assert.equal(P.glassThemeAllowed({ themes: true, tijani_guide: false }), true);
assert.equal(P.tijaniGuideAllowed({ themes: true, tijani_guide: false }), false);
assert.equal(P.tijaniGuideAllowed({ tijani_guide: true }), true);
assert.equal(P.limitsOf({ limits: { themes: true } }).themes, true);
assert.equal(P.limitsOf(null), null);
for (const k of P.ALWAYS_FREE) assert.equal(P.featureEnabled({}, k), false);

console.log('test-tijani-wird OK');
