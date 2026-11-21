// Logique de la passe A++ : lieu illisible, créneau d’adhan, nombres selon la langue, rose des vents.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { prayer: P, 'adhan-slot': A, 'locale-format': F, 'gps-hint': G, 'ui-cat/en': EN, 'ui-cat/ar': AR, 'ui-cat/de': DE } = await loadLib(
  ['prayer', 'adhan-slot', 'locale-format', 'gps-hint', 'ui-cat/en', 'ui-cat/ar', 'ui-cat/de'],
  'a-plus',
);

const day = new Date(2026, 5, 21, 12, 0, 0);
const lausanne = P.computeDay(day, P.DEFAULT_PLACE, 'MuslimWorldLeague', 'shafi').map((r) => r.time.getTime());

assert.equal(P.isUsablePlace(P.DEFAULT_PLACE), true);
assert.equal(P.isUsablePlace({ lat: 0, lng: 0 }), true);
assert.equal(P.isUsablePlace({ lat: Number.NaN, lng: 6.6 }), false);
assert.equal(P.isUsablePlace({ lat: 91, lng: 0 }), false);
assert.equal(P.isUsablePlace(null), false);

const bad = { lat: Number.NaN, lng: 999, label: 'cassé', source: 'gps' };
assert.deepEqual(P.computeDay(day, bad, 'MuslimWorldLeague', 'shafi').map((r) => r.time.getTime()), lausanne);
assert.equal(P.qiblaBearing(bad), P.qiblaBearing(P.DEFAULT_PLACE));
assert.ok(Number.isFinite(P.distanceToKaabaKm(bad)));
assert.ok(P.distanceToKaabaKm(bad) > 1000);

const recent = new Map();
assert.equal(A.claimAdhanSlot('p1', 1_000, recent, false), false);
assert.equal(recent.has('p1'), false, 'voix pas prête : le créneau reste libre');
assert.equal(A.claimAdhanSlot('p1', 1_000, recent, true), true);
assert.equal(A.claimAdhanSlot('p1', 1_000 + 5_000, recent, true), false);
assert.equal(A.claimAdhanSlot('p1', 1_000 + A.ADHAN_DEDUPE_MS, recent, true), true);
A.releaseAdhanSlot('p1', recent);
assert.equal(A.claimAdhanSlot('p1', 2_000, recent, true), true, 'échec de lecture : on peut réessayer');
assert.equal(A.claimAdhanSlot('', 3_000, recent, true), true, 'sans identifiant, pas de blocage');

assert.equal(F.formatCount(1234, 'en'), '1,234');
assert.equal(F.formatCount(1234, 'de'), '1.234');
assert.equal(F.formatCount(1234, 'de-CH'), "1'234");
assert.equal(F.formatCount(1234567, 'it'), '1.234.567');
assert.equal(F.formatCount(1234, 'ar'), '1,234');
assert.equal(/[٠-٩]/.test(F.formatCount(1234567, 'ar')), false);
assert.equal(F.formatCount(Number.NaN, 'fr'), '0');
assert.match(F.formatCount(1234, 'fr'), /^1.234$/);

const start = new Date(2026, 5, 2, 8, 5).toISOString();
const end = new Date(2026, 5, 2, 8, 40).toISOString();
const span = F.formatSessionSpan(start, end, 'en');
assert.match(span, /08:05/);
assert.match(span, /08:40/);
assert.equal(span.includes('–'), true);
const other = F.formatSessionSpan(new Date(2026, 5, 1, 22, 0).toISOString(), end, 'fr');
assert.equal(other.split('–').length, 2);

assert.deepEqual(F.compassPoints('fr'), ['N', 'E', 'S', 'O']);
assert.deepEqual(F.compassPoints('it'), ['N', 'E', 'S', 'O']);
assert.deepEqual(F.compassPoints('en'), ['N', 'E', 'S', 'W']);
assert.deepEqual(F.compassPoints('de'), ['N', 'O', 'S', 'W']);
assert.deepEqual(F.compassPoints('ar'), ['N', 'E', 'S', 'W']);

for (const key of [G.GPS_DENIED, G.GPS_UNAVAILABLE, 'Zikru a rencontré une erreur']) {
  assert.equal(typeof EN.CAT[key], 'string', 'en ' + key);
  assert.equal(typeof AR.CAT[key], 'string', 'ar ' + key);
  assert.equal(typeof DE.CAT[key], 'string', 'de ' + key);
}
assert.equal(G.gpsHint('denied'), G.GPS_DENIED);
assert.equal(G.GPS_TIMEOUT_MS >= 8_000 && G.GPS_TIMEOUT_MS <= 20_000, true);

console.log('test-a-plus OK');
