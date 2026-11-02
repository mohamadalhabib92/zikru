// Mode dispense : la série est suspendue, pas cassée. Les jours actifs comptent encore.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { streak: S, dispense: D } = await loadLib(['streak', 'dispense']);
const active = new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-06']);
const excused = (k) => k === '2026-11-04' || k === '2026-11-05';
const today = new Date(2026, 10, 6, 15);
assert.equal(S.streak((k) => active.has(k), today), 1, 'sans dispense, le trou casse la série');
assert.equal(S.streak((k) => active.has(k), today, excused), 4, 'les jours de dispense ne cassent pas la série');
assert.equal(S.bestStreak([...active]), 3);
assert.equal(S.bestStreak([...active], excused), 4);

const on = D.setDispense(null, true, '2026-11-04');
assert.equal(on.on, true);
assert.equal(D.dispenseCovers(on, '2026-11-05', '2026-11-06'), true);
assert.equal(D.dispenseCovers(on, '2026-11-03', '2026-11-06'), false);
const off = D.setDispense(on, false, '2026-11-06');
assert.equal(off.on, false);
assert.equal(D.dispenseCovers(off, '2026-11-05', '2026-11-07'), true);
assert.equal(D.dispenseCovers(off, '2026-11-08', '2026-11-09'), false);
console.log('test-streak OK');
