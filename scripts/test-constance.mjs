// Séries douces (1 grâce / semaine) et agrégats : dhikr et objectifs restent séparés.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const M = await loadLib(['constance', 'goals'], 'constance');
const C = M.constance;
const G = M.goals;

const prefs = G.normalizeGoals({ on: { prayers: true, wird: false, quran: false, tasbih: true }, target: { prayers: 5, wird: 1, quran: 1, tasbih: 100 } });
const clicks = {
  '2026-03-02': 120,
  '2026-03-03': 40,
  '2026-03-04': 10,
  '2026-03-06': 200,
  '2026-03-07': 80,
  '2026-03-08': 5,
};
const prayed = {
  '2026-03-02': ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
  '2026-03-03': ['fajr'],
  '2026-03-06': ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
};
const src = { prayed, clicks, pages: { '2026-03-06': [1, 2, 2] }, tijani: {}, adhkar: {}, practices: [] };
const values = C.sourcesOf(src);
const today = new Date(2026, 2, 8, 18, 0);

const z = C.zikrStreak(values, today);
assert.equal(z.days, 6, '2, 3, 4, grâce le 5, puis 6, 7, 8');
assert.deepEqual(z.graceDays, ['2026-03-05']);
assert.equal(C.CONSTANCE_GRACE, 1);

const only = { ...clicks };
delete only['2026-03-03'];
delete only['2026-03-04'];
delete only['2026-03-06'];
delete only['2026-03-07'];
delete only['2026-03-08'];
const valuesGap = C.sourcesOf({ ...src, clicks: only });
const broken = C.zikrStreak(valuesGap, new Date(2026, 2, 5, 12));
assert.equal(broken.days, 0, 'deux jours manqués dans la même semaine arrêtent la série avant le jour accompli');

const g = C.goalStreak(values, prefs, today);
assert.ok(g.days < z.days, 'la série d’objectifs n’est pas la série de dhikr');
assert.equal(values('2026-03-02').tasbih, 120);
assert.equal(G.allMet(values('2026-03-02'), prefs), true);
assert.equal(G.allMet(values('2026-03-03'), prefs), false, '40 dhikr n’atteignent pas la cible 100, et les prières sont incomplètes');

const bars = C.weekBars(values, prefs, today, 2);
const last = bars[bars.length - 1];
assert.equal(last.zikr, 120 + 40 + 10 + 200 + 80 + 5);
assert.equal(last.met, 2, 'seulement les jours où prières ET tasbih sont atteints');
assert.notEqual(last.zikr, last.met);

const months = C.monthBars(values, prefs, today, 1);
assert.equal(months[0].key, '2026-03-01');
assert.equal(months[0].zikr, last.zikr);
assert.equal(months[0].pages, 2, 'la page en double ne compte qu’une fois');

const heat = C.heatGrid(values, prefs, { today, weeks: 12 });
const hi = heat.find((c) => c.key === '2026-03-06');
const lo = heat.find((c) => c.key === '2026-03-08');
assert.ok(hi.level > lo.level, 'l’intensité suit le volume, pas une note');
assert.equal(hi.objectiveMet, true);
assert.equal(lo.objectiveMet, false);
assert.equal(heat.find((c) => c.key === '2026-03-05').level, 0);

const activeZ = (k) => (values(k).tasbih || 0) > 0;
const best = C.bestGentle(activeZ, '2026-03-01', '2026-03-08');
const peak = (act, a, b, neutral = () => false) => {
  let m = 0;
  for (let k = a; k <= b; k = C.addDays(k, 1)) {
    if (!act(k)) continue;
    m = Math.max(m, G.gentleStreak(act, new Date(`${k}T12:00:00`), neutral, C.CONSTANCE_GRACE).days);
  }
  return m;
};
assert.equal(best, peak(activeZ, '2026-03-01', '2026-03-08'), 'la meilleure série suit la même règle, un jour accompli à la fois');
assert.ok(best >= z.days);

const span = {};
for (let i = 0; i < 40; i++) span[C.addDays('2026-01-05', i)] = i % 5 === 0 ? 0 : 10 + i;
const srcSpan = C.sourcesOf({ prayed: {}, clicks: span, pages: {}, tijani: {}, adhkar: {}, practices: [] });
const act = (k) => (srcSpan(k).tasbih || 0) > 0;
assert.equal(C.bestGentle(act, '2026-01-05', '2026-02-13'), peak(act, '2026-01-05', '2026-02-13'));

const neutral = (k) => k === '2026-03-05';
const spared = C.zikrStreak(values, today, neutral);
assert.equal(spared.graceDays.includes('2026-03-05'), false, 'un jour en dispense n’est pas une grâce consommée');
assert.ok(spared.days >= z.days);

assert.deepEqual(
  C.milestoneViews(40).filter((m) => m.reached).map((m) => m.days),
  [7, 30, 40],
);

const spring = C.addDays('2026-03-28', 1);
assert.equal(spring, '2026-03-29', 'le changement d’heure ne saute pas un jour');
assert.equal(C.addDays('2026-10-24', 1), '2026-10-25');

const q = C.quranWindow(values, (k) => k === '2026-03-06', today, 14);
assert.equal(q.find((d) => d.key === '2026-03-06').pages, 2);
assert.equal(q.find((d) => d.key === '2026-03-06').read, true);
assert.ok(!q.some((d) => d.verses != null));

console.log('constance : série, grâce, barres et calendrier OK');
