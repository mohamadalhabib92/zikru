// Contrat du relevé montre : mêmes heures que `adhan` sur le téléphone, dédoublonnage des appuis.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { prayer: P, 'watch-snapshot': W } = await loadLib(['prayer', 'watch-snapshot'], 'watch');

const place = P.CITIES[0];
const now = new Date(2026, 5, 15, 10, 0, 0);
const names = { fajr: 'Fajr', sunrise: 'Lever', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
const snap = W.buildWatchSnapshot({
  now,
  place,
  method: 'MuslimWorldLeague',
  madhab: 'shafi',
  names,
  ar: P.AR_NAMES,
  dhikrs: [{ id: 'subhanallah', ar: 'سُبْحَانَ ٱللَّٰهِ', tr: 'Subḥāna-llāh', target: 33, source: 'Ṣaḥīḥ Muslim, n° 597', example: true }],
  cues: ['fajr', 'sunrise', 'dhuhr'],
});

assert.equal(snap.v, 1);
assert.equal(snap.days.length, 8);
assert.equal(snap.placeLabel, 'Lausanne');
assert.deepEqual(snap.cues, ['fajr', 'dhuhr']);
assert.equal(snap.dhikrs[0].ar, 'سُبْحَانَ ٱللَّٰهِ');
assert.equal(snap.dhikrs[0].example, true);

for (const day of snap.days) {
  assert.equal(day.prayers.length, 6);
  const phone = P.computeDay(new Date(day.start + 12 * 3600 * 1000), place, 'MuslimWorldLeague', 'shafi');
  phone.forEach((p, i) => {
    assert.equal(day.prayers[i].key, p.key);
    assert.equal(day.prayers[i].at, p.time.getTime());
  });
  for (let i = 1; i < day.prayers.length; i++) assert.ok(day.prayers[i].at > day.prayers[i - 1].at);
}

const noon = snap.days[0].prayers.find((p) => p.key === 'dhuhr');
const before = W.nextPrayer(snap, noon.at - 1);
assert.equal(before.key, 'dhuhr');
const afterIsha = W.nextPrayer(snap, snap.days[0].prayers[5].at);
assert.equal(afterIsha.key, 'fajr');
assert.equal(afterIsha.at, snap.days[1].prayers[0].at);
assert.equal(W.dayCovering(snap, snap.days[0].start + 1000).start, snap.days[0].start);
assert.equal(W.dayCovering(snap, snap.staleAfter), null);
assert.equal(W.nextPrayer(snap, snap.staleAfter), null);

const again = W.parseSnapshot(JSON.parse(JSON.stringify(snap)));
assert.deepEqual(again, snap);
assert.equal(W.parseSnapshot({ v: 2 }), null);

const id = '11111111-2222-4333-8444-555555555555';
const click = { id, dhikrId: 'subhanallah', delta: 1, target: 33, at: 1 };
assert.deepEqual(W.parseClick(click), click);
assert.equal(W.parseClick({ ...click, delta: 0 }), null);
assert.equal(W.parseClick({ ...click, id: 'court' }), null);
const seen = new Set();
assert.equal(W.unseenClicks([click, click, { ...click, delta: 2 }], seen).length, 1);
assert.equal(W.unseenClicks([click], seen).length, 0);
assert.deepEqual(W.countdownParts(3_661_000), { h: 1, m: 1, s: 1 });

console.log('test-watch-snapshot OK');
