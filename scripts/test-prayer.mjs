// Horaires : ajustement, mosquée prioritaire, UOIF et hautes latitudes sans réseau.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { prayer: P } = await loadLib(['prayer']);
const place = { lat: 46.5197, lng: 6.6323, label: 'Lausanne', source: 'manual' };
const day = new Date(2026, 5, 21, 12);
const base = P.computeDay(day, place, 'MuslimWorldLeague', 'shafi');
const plus = P.computeDay(day, place, 'MuslimWorldLeague', 'shafi', { adjustments: { fajr: 5, asr: -3 } });
const fajr = (rows) => rows.find((x) => x.key === 'fajr').time.getTime();
const asr = (rows) => rows.find((x) => x.key === 'asr').time.getTime();
assert.equal(fajr(plus) - fajr(base), 5 * 60000);
assert.equal(asr(plus) - asr(base), -3 * 60000);
assert.equal(P.clampAdjust(400), 90);
assert.equal(P.clampAdjust(-400), -90);

const mos = P.computeDay(day, place, 'MuslimWorldLeague', 'shafi', {
  adjustments: { dhuhr: 40 },
  mosque: { enabled: true, label: 'Mosquée', times: { dhuhr: '13:15', fajr: 'n/a' } },
});
const dhuhr = mos.find((x) => x.key === 'dhuhr');
assert.equal(dhuhr.source, 'mosque');
assert.equal(dhuhr.time.getHours(), 13);
assert.equal(dhuhr.time.getMinutes(), 15);
assert.equal(mos.find((x) => x.key === 'fajr').source, 'calc');
assert.equal(mos.find((x) => x.key === 'asr').source, 'calc');

for (const method of ['UOIF', 'Turkey', 'NorthAmerica', 'Egyptian', 'Karachi', 'UmmAlQura']) {
  const rows = P.computeDay(day, place, method, 'hanafi', { highLat: 'seventh' });
  assert.equal(rows.length, 6, method);
  assert.ok(rows.every((r) => r.time instanceof Date && !Number.isNaN(r.time.getTime())), method);
}
const uoif = P.computeDay(day, place, 'UOIF', 'shafi');
const mwl = P.computeDay(day, place, 'MuslimWorldLeague', 'shafi');
assert.notEqual(fajr(uoif), fajr(mwl));
assert.equal(P.resolveDefaultMethod('YOUR_DEFAULT_PRAYER_METHOD'), 'MuslimWorldLeague');
assert.equal(P.resolveDefaultMethod('Turkey'), 'Turkey');
assert.equal(P.resolveDefaultMethod('nope'), 'MuslimWorldLeague');
console.log('test-prayer OK');
