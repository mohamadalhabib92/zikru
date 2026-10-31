// Passe 2 (brief §5, §7, §8) : adhkar par moment (textes existants seulement), centre de notifications
// (heures calmes, bilan), objectifs et série douce, données des widgets.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const M = await loadLib(['adhkar', 'duas', 'review-sheet', 'notify-plan'], 'pass2');
const A = M.adhkar, D = M.duas, R = M['review-sheet'], N = M['notify-plan'];
let ok = 0;
const t = (name, fn) => {
  fn();
  ok++;
  console.log('✓ ' + name);
};

// ---------- Adhkar ----------
const WHEN = { matin: /matin/i, soir: /soir/i, 'apres-priere': /prière|salat|fajr/i, sommeil: /couch|dormir|sommeil/i };
t('adhkar : tous les identifiants existent dans duas.ts', () => assert.deepEqual(A.unknownAdhkarIds(), []));
t('adhkar : chaque invocation a arabe, translittération, traduction et référence', () => {
  for (const m of A.ADHKAR_MOMENTS) {
    const list = A.adhkarFor(m);
    assert.ok(list.length >= 5, m);
    for (const d of list) for (const k of ['ar', 'tr', 'fr', 'ref']) assert.ok(d[k] && d[k].trim().length > 2, `${m}:${d.id}:${k}`);
  }
});
t('adhkar : le moment vient du champ « when » (ou de la catégorie après-prière) de chaque invocation', () => {
  for (const m of A.ADHKAR_MOMENTS) for (const d of A.adhkarFor(m)) assert.ok(WHEN[m].test(d.when ?? '') || (m === 'apres-priere' && d.cat === 'apres-priere'), `${m}:${d.id} « ${d.when} »`);
});
t('adhkar : formules du matin et du soir non mélangées, Āyat al-Kursī seulement au coucher', () => {
  assert.ok(!A.ADHKAR_IDS.soir.includes('sabah'));
  assert.ok(!A.ADHKAR_IDS.matin.includes('amsayna'));
  assert.ok(!A.ADHKAR_IDS['apres-priere'].includes('kursi'));
  assert.equal(A.ADHKAR_IDS.sommeil.at(-1), 'aslamtu');
});
t('adhkar : aucun texte écrit pour les éléments « source à compléter »', () => {
  for (const x of A.ADHKAR_TO_COMPLETE) {
    assert.ok(!/[\u0600-\u06FF]/.test(x.title + x.todo), x.uid);
    assert.ok(x.moments.length);
  }
});
t('adhkar : fiche savante — classement « à valider », sources manquantes « source à compléter »', () => {
  const rows = R.reviewRows();
  for (const m of A.ADHKAR_MOMENTS) assert.equal(rows.find((r) => r.uid === `adhkar:moment:${m}`)?.status, 'a_valider', m);
  for (const x of A.ADHKAR_TO_COMPLETE) assert.equal(rows.find((r) => r.uid === x.uid)?.status, 'source_a_completer', x.uid);
  assert.equal(new Set(rows.map((r) => r.uid)).size, rows.length, 'uid uniques');
});
t('adhkar : moment proposé selon l’heure', () => {
  const d = (h, mi = 0) => new Date(2026, 10, 2, h, mi);
  const times = { fajr: d(6, 10), asr: d(14, 30), isha: d(18, 40) };
  assert.equal(A.momentAt(d(7), times), 'matin');
  assert.equal(A.momentAt(d(16), times), 'soir');
  assert.equal(A.momentAt(d(21), times), 'sommeil');
  assert.equal(A.momentAt(d(2), times), 'sommeil');
  assert.equal(A.momentAt(d(5), times), 'matin');
});
t('adhkar : progression (sans nombre = 1)', () => {
  const list = A.adhkarFor('matin');
  const p = Object.fromEntries(list.map((x) => [x.id, A.repsOf(x)]));
  assert.deepEqual(A.momentDone('matin', p), { done: list.length, total: list.length });
  assert.equal(A.momentDone('matin', {}).done, 0);
});

// ---------- Centre de notifications ----------
const H = { fajr: [5, 30], sunrise: [7, 5], dhuhr: [12, 20], asr: [15, 0], maghrib: [17, 30], isha: [19, 0] };
const compute = (d) => Object.entries(H).map(([key, [h, m]]) => ({ key, time: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m) }));
const LBL = { prayer: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }, place: 'Lieu', atTime: 'Heure', inMin: (n) => `dans ${n} min`, kahfTitle: 'Kahf', kahfBody: '', jumuaTitle: 'Jumua', jumuaBody: '', morningTitle: 'AM', eveningTitle: 'PM', adhkarBody: '', wirdMorning: 'WA', wirdEvening: 'WP', wazifa: 'Waz', hailala: 'Hail', wirdBody: '', quranTitle: 'Coran', quranBody: '', pausedTitle: 'Pause', pausedBody: '', recapTitle: 'Semaine', recapBody: '' };
const sunday = new Date(2026, 10, 1, 12);
t('notifications : défauts — heures calmes et bilan désactivés', () => {
  assert.equal(N.DEFAULT_NOTIF.recap, false);
  assert.equal(N.DEFAULT_NOTIF.quiet.on, false);
  assert.ok(!N.eventsForDay(sunday, compute(sunday), N.DEFAULT_NOTIF, LBL).some((e) => e.kind === 'recap'));
});
t('notifications : bilan le dimanche seulement, vers /goals', () => {
  const p = { ...N.DEFAULT_NOTIF, recap: true };
  const r = N.eventsForDay(sunday, compute(sunday), p, LBL).filter((e) => e.kind === 'recap');
  assert.equal(r.length, 1);
  assert.equal(r[0].url, '/goals');
  assert.equal(r[0].date.getHours(), 19);
  const mon = new Date(2026, 10, 2, 12);
  assert.ok(!N.eventsForDay(mon, compute(mon), p, LBL).some((e) => e.kind === 'recap'));
});
t('notifications : heures calmes (créneau passant minuit) retirent les rappels secondaires, jamais les adhans', () => {
  const q = { on: true, from: '22:30', to: '06:30' };
  assert.ok(N.inQuiet(new Date(2026, 10, 2, 23, 0), q));
  assert.ok(N.inQuiet(new Date(2026, 10, 2, 5, 0), q));
  assert.ok(!N.inQuiet(new Date(2026, 10, 2, 6, 30), q));
  assert.ok(!N.inQuiet(new Date(2026, 10, 2, 12, 0), q));
  const day = new Date(2026, 10, 2, 12);
  const prefs = { ...N.DEFAULT_NOTIF, before: 10, adhkar: true, wird: true, quiet: q };
  const ev = N.eventsForDay(day, compute(day), prefs, LBL);
  assert.ok(ev.some((e) => e.kind === 'prayer' && e.id.endsWith('-fajr')), 'adhan du Fajr gardé');
  assert.ok(!ev.some((e) => e.id.endsWith('-fajr-pre')), 'rappel 05:20 retiré');
  assert.ok(!ev.some((e) => e.id.endsWith('-wird-am')), 'wird 06:00 retiré');
  assert.ok(ev.some((e) => e.id.endsWith('-adhkar-am')), 'adhkar 06:45 gardé');
  assert.ok(!N.inQuiet(new Date(2026, 10, 2, 23, 0), { on: true, from: '23:00', to: '23:00' }), 'créneau vide');
  assert.ok(!N.inQuiet(new Date(2026, 10, 2, 23, 0), { on: true, from: 'xx', to: '06:00' }), 'heure invalide');
});
t('notifications : les adhkar ouvrent l’écran du bon moment', () => {
  const day = new Date(2026, 10, 2, 12);
  const ev = N.eventsForDay(day, compute(day), { ...N.DEFAULT_NOTIF, adhkar: true }, LBL);
  assert.equal(ev.find((e) => e.id.endsWith('adhkar-am')).url, '/adhkar?m=matin');
  assert.equal(ev.find((e) => e.id.endsWith('adhkar-pm')).url, '/adhkar?m=soir');
});
t('notifications : plan avec tout activé ≤ 64', () => {
  const p = N.buildPlan(new Date(2026, 10, 2, 10), compute, { ...N.DEFAULT_NOTIF, before: 10, adhkar: true, wird: true, recap: true, quran: 'isha', quiet: { on: true, from: '22:00', to: '06:00' } }, LBL);
  assert.ok(p.length <= 64);
});

console.log(`\n${ok} tests Passe 2 OK`);
