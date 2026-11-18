// Fenêtre de la Haylala : vendredi local, après l’Asr et avant le Maghrib.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'haylala-window': H } = await loadLib(['haylala-window'], 'haylala');
const at = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm, 0, 0);
const FRI = at(2026, 11, 20, 16, 0); // vendredi
const WED = at(2026, 11, 18, 16, 0);
const asr = at(2026, 11, 20, 15, 0);
const maghrib = at(2026, 11, 20, 17, 30);

assert.equal(H.isLocalFriday(FRI), true);
assert.equal(H.isLocalFriday(WED), false);
assert.equal(new Date(2026, 10, 20).getDay(), 5, 'le 20 novembre 2026 est un vendredi');

const hidden = H.haylalaWindow(WED, asr, maghrib);
assert.deepEqual(hidden, { shown: false, reason: 'not-friday' });
assert.equal(H.haylalaCountable(hidden), false);

const before = H.haylalaWindow(at(2026, 11, 20, 14, 59), asr, maghrib);
assert.equal(before.shown, true);
assert.equal(before.phase, 'before-asr');
assert.equal(H.haylalaCountable(before), false);

const opens = H.haylalaWindow(asr, asr, maghrib);
assert.equal(opens.phase, 'open');
assert.equal(H.haylalaCountable(opens), true);

const during = H.haylalaWindow(FRI, asr, maghrib);
assert.equal(during.phase, 'open');
assert.equal(during.closesAt.getTime(), maghrib.getTime());

const last = H.haylalaWindow(new Date(maghrib.getTime() - 1), asr, maghrib);
assert.equal(last.phase, 'open');

const closed = H.haylalaWindow(maghrib, asr, maghrib);
assert.equal(closed.phase, 'after-maghrib');
assert.equal(H.haylalaCountable(closed), false);
assert.equal(H.haylalaWindow(at(2026, 11, 20, 18, 0), asr, maghrib).phase, 'after-maghrib');

const unknown = H.haylalaWindow(FRI, null, maghrib);
assert.equal(unknown.shown, true);
assert.equal(unknown.phase, 'times-unknown');
assert.equal(H.haylalaCountable(unknown), false);
assert.equal(H.haylalaWindow(FRI, maghrib, asr).phase, 'times-unknown');

const sun = at(2026, 11, 22, 16, 0);
assert.equal(sun.getDay(), 0);
assert.equal(H.haylalaWindow(sun, asr, maghrib).shown, false);

console.log('test-haylala OK');
