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
const L = { prayer: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }, place: 'Martigny', atTime: 'Heure', inMin: (n) => `dans ${n} min`, kahfTitle: 'Kahf', kahfBody: '', jumuaTitle: 'Jumua', jumuaBody: '', morningTitle: 'AM', eveningTitle: 'PM', adhkarBody: '', wirdMorning: 'WA', wirdEvening: 'WP', wazifa: 'Waz', hailala: 'Hail', wirdBody: '', pausedTitle: 'Pause', pausedBody: '' };
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
t('toutes options : ≤ 64, ordre chronologique, jours entiers', () => {
  const p = P.buildPlan(now, compute, all, L);
  assert.ok(p.length <= 64, String(p.length));
  for (let i = 1; i < p.length; i++) assert.ok(p[i].date >= p[i - 1].date);
  const days = new Set(p.filter((e) => e.kind !== 'paused').map((e) => e.date.toDateString()));
  for (const d of [...days].slice(1)) { const n = p.filter((e) => e.kind !== 'paused' && e.date.toDateString() === d).length; assert.ok(n >= 15, `${d} ${n}`); }
});
t('vendredi : al-Kahf, Jumu‘a, Hailala', () => {
  const p = P.buildPlan(now, compute, all, L).filter((e) => e.date.getDay() === 5);
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
console.log(`Notifications : ${ok} tests passent.`);
