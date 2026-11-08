// Tests du plan de rappels : limite iOS de 64, jours entiers, options, ordre chronologique.
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const dir = mkdtempSync(join(tmpdir(), 'notif-'));
const src = readFileSync(new URL('../src/lib/notify-plan.ts', import.meta.url), 'utf8');
writeFileSync(join(dir, 'p.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const P = await import(join(dir, 'p.mjs'));
let ok = 0;
const t = (name, fn) => { fn(); ok++; console.log('✓', name); };
const H = { fajr: [5, 30], sunrise: [7, 5], dhuhr: [12, 20], asr: [15, 0], maghrib: [17, 30], isha: [19, 0] };
const compute = (d) => Object.entries(H).map(([key, [h, m]]) => ({ key, time: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m) }));
const L = { prayer: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }, place: 'Martigny', atTime: 'Heure', inMin: (n) => `dans ${n} min`, kahfTitle: 'Kahf', kahfBody: '', jumuaTitle: 'Jumua', jumuaBody: '', morningTitle: 'AM', eveningTitle: 'PM', adhkarBody: '', wirdMorning: 'WA', wirdEvening: 'WP', wazifa: 'Waz', hailala: 'Hail', wirdBody: '', quranTitle: 'Coran', quranBody: '', pausedTitle: 'Pause', pausedBody: '' };
const D = P.DEFAULT_NOTIF;
const now = new Date(2026, 9, 28, 10, 0); // mercredi 10:00
const all = { ...D, before: 10, adhkar: true, wird: true, friday: true };
t('défaut : 5 prières/jour, ≤ 64 au total', () => {
  const p = P.buildPlan(now, compute, D, L);
  assert.ok(p.length <= 64);
  assert.equal(p.filter((e) => e.kind === 'prayer' && e.date.getDate() === 29).length, 5);
  assert.equal(p[p.length - 1].kind, 'paused');
});
t('aujourd’hui : seulement les prières futures', () => {
  const p = P.buildPlan(now, compute, D, L);
  assert.deepEqual(p.filter((e) => e.date.getDate() === 28).map((e) => e.id.split('-').pop()), ['dhuhr', 'asr', 'maghrib', 'isha']);
});
t('toutes options : ≤ 64, ordre chronologique, rappels secondaires par jours entiers', () => {
  const p = P.buildPlan(now, compute, all, L);
  assert.ok(p.length <= 64, String(p.length));
  for (let i = 1; i < p.length; i++) assert.ok(p[i].date >= p[i - 1].date);
  // jours couverts par les rappels secondaires : contigus depuis aujourd’hui, et chacun complet
  const full = P.eventsForDay;
  const secDays = [...new Set(p.filter((e) => !['prayer', 'paused'].includes(e.kind)).map((e) => e.date.toDateString()))];
  secDays.forEach((d, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    assert.equal(day.toDateString(), d, 'contigus');
    const want = full(day, compute(day), all, L).filter((e) => e.kind !== 'prayer' && e.date > now).length;
    assert.equal(p.filter((e) => !['prayer', 'paused'].includes(e.kind) && e.date.toDateString() === d).length, want, `${d} complet`);
  });
});
t('vendredi : al-Kahf, Jumu‘a, Hailala (veille au soir)', () => {
  const thu = new Date(2026, 9, 29, 21, 0);
  const p = P.buildPlan(thu, compute, all, L).filter((e) => e.date.getDay() === 5);
  assert.ok(p.some((e) => e.id.endsWith('kahf')) && p.some((e) => e.id.endsWith('jumua')) && p.some((e) => e.id.endsWith('hailala')));
  assert.ok(!P.buildPlan(now, compute, all, L).some((e) => e.date.getDay() === 4 && e.id.endsWith('kahf')));
});
t('rappel avant : 10 min avant l’adhan', () => {
  const p = P.buildPlan(now, compute, all, L);
  const pre = p.find((e) => e.id.endsWith('asr-pre')), at = p.find((e) => e.id === pre.id.replace('-pre', ''));
  assert.equal(at.date - pre.date, 10 * 60000);
  assert.equal(pre.title, 'Asr dans 10 min');
});
t('prière désactivée : absente', () => {
  const p = P.buildPlan(now, compute, { ...D, prayers: { ...D.prayers, fajr: false } }, L);
  assert.ok(!p.some((e) => e.id.endsWith('fajr')));
});
t('aucune prière : seulement la pause (ou rien)', () => {
  const none = { ...D, friday: false, prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false } };
  assert.equal(P.buildPlan(now, compute, none, L).length, 0);
});
t('empreinte stable', () => {
  assert.equal(P.planHash(P.buildPlan(now, compute, D, L)), P.planHash(P.buildPlan(now, compute, D, L)));
});
// ---------- 7 jours sans trou (brief §3/§16) ----------
const fardTimes = (from, to, cmp) => {
  const out = [];
  for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12); d <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12))
    for (const x of cmp(d)) if (P.FARD_KEYS.includes(x.key) && x.time > from && x.time <= to) out.push(x);
  return out;
};
for (const [label, prefs] of [['défaut', D], ['toutes options', { ...all, quran: 'isha' }], ['avant 30 min', { ...D, before: 30 }]]) {
  t(`7 jours sans ouvrir l’app (${label}) : chaque adhan est programmé, ≤ 64`, () => {
    for (const start of [now, new Date(2026, 9, 28, 0, 1), new Date(2026, 9, 28, 23, 50), new Date(2026, 2, 28, 22, 0)]) {
      const p = P.buildPlan(start, compute, prefs, L);
      assert.ok(p.length <= 64, `${p.length}`);
      const ids = new Set(p.map((e) => `${e.kind}@${e.date.getTime()}`));
      const end = new Date(start.getTime() + 7 * 86400000);
      const need = fardTimes(start, end, compute);
      assert.ok(need.length >= 34, String(need.length));
      for (const x of need) assert.ok(ids.has(`prayer@${x.time.getTime()}`), `${label} ${start.toISOString()} ${x.key} ${x.time.toISOString()}`);
      const paused = p.find((e) => e.kind === 'paused');
      assert.ok(paused && paused.date > end, 'rappel « ouvrez Zikru » après les 7 jours');
    }
  });
}
t('ouverture quotidienne pendant 30 jours : aucun adhan manqué', () => {
  let missed = 0;
  for (let i = 0; i < 30; i++) {
    const open = new Date(2026, 9, 28 + i, 8 + (i % 12), 17);
    const until = new Date(open.getTime() + 86400000);
    const p = P.buildPlan(open, compute, { ...all, quran: 'fajr' }, L);
    const ids = new Set(p.map((e) => `${e.kind}@${e.date.getTime()}`));
    missed += fardTimes(open, until, compute).filter((x) => !ids.has(`prayer@${x.time.getTime()}`)).length;
    assert.ok(p.length <= 64);
  }
  assert.equal(missed, 0);
});
t('mode dispense « prières » : ni adhan, ni rappel avant, ni Jumu‘a ; adhkar conservés ; reprise après la pause', () => {
  const until = new Date(2026, 9, 31, 0, 0); // pause mer 28 → ven 30 inclus
  const pause = (d) => (d < until ? 'prayers' : 'none');
  const p = P.buildPlan(now, compute, { ...all }, L, 63, 30, pause);
  const inPause = p.filter((e) => e.date < until);
  assert.ok(!inPause.some((e) => e.kind === 'prayer' || e.kind === 'before' || e.id.endsWith('jumua')));
  assert.ok(inPause.some((e) => e.kind === 'adhkar'), 'adhkar gardés');
  assert.ok(p.some((e) => e.kind === 'prayer' && e.date.getDate() === 31), 'reprise le 31');
  const pAll = P.buildPlan(now, compute, { ...all }, L, 63, 30, (d) => (d < until ? 'all' : 'none'));
  assert.equal(pAll.filter((e) => e.date < until && e.kind !== 'paused').length, 0);
  assert.ok(pAll.length <= 64);
});
t('dates invalides (latitude extrême) : ignorées sans planter', () => {
  const bad = (d) => compute(d).map((x) => (x.key === 'isha' ? { ...x, time: new Date(NaN) } : x));
  const p = P.buildPlan(now, bad, D, L);
  assert.ok(p.every((e) => Number.isFinite(e.date.getTime())));
});
console.log(`Notifications : ${ok} tests passent.`);
