// Tests du mode Ramadan (Pass 4) : dates et activation (tabulaire + Umm al-Qura), confirmation locale,
// compte à rebours suhur / iftar (y compris à travers un changement d’heure), suivis privés (jeûne, tarawih),
// zakat al-fitr (montant saisi seulement) et budget de notifications avec suhur / iftar prioritaires.
process.env.TZ = 'Europe/Zurich'; // fuseau de l’utilisateur ; les changements d’heure y sont testés
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { hijri: H, ramadan: R, 'notify-plan': P, prayer: PR, 'widget-data': W } = await loadLib(['hijri', 'ramadan', 'notify-plan', 'prayer', 'widget-data'], 'ramadan');
let ok = 0;
const test = (n, f) => {
  f();
  ok++;
  console.log('✓', n);
};
const D = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi);
const k = (d) => R.dayKey(d);
const P0 = R.DEFAULT_RAMADAN;

// ——— Calendrier ———
test('tabulaire : 1 Ramadan 1446 = 01.03.2025, 1447 = 18.02.2026, 1448 = 08.02.2027 (30 j)', () => {
  assert.equal(k(H.hijriToDate({ year: 1446, month: 9, day: 1 }, 0, 'tabular')), '2025-03-01');
  assert.equal(k(H.hijriToDate({ year: 1447, month: 9, day: 1 }, 0, 'tabular')), '2026-02-18');
  assert.equal(k(H.hijriToDate({ year: 1448, month: 9, day: 1 }, 0, 'tabular')), '2027-02-08');
  assert.equal(H.monthLength(1448, 9, 'tabular'), 30);
});
test('calendrier par défaut = tabulaire (rien ne change sans choix explicite)', () => {
  assert.equal(H.hijriCalendar(), 'tabular');
});
test('Umm al-Qura (ICU) : auto-contrôle, 1448 = 08.02.2027 → 08.03.2027 (29 j), continuité 1440–1460', () => {
  assert.equal(H.umalquraAvailable(), true, 'ICU complet attendu sous Node');
  H.setHijriCalendar('umalqura');
  try {
    assert.equal(H.hijriCalendar(), 'umalqura');
    assert.equal(k(H.hijriToDate({ year: 1448, month: 9, day: 1 })), '2027-02-08');
    assert.equal(H.monthLength(1448, 9), 29);
    assert.deepEqual(H.toHijri(D(2027, 3, 9)), { year: 1448, month: 10, day: 1 });
    assert.deepEqual(H.toHijri(D(2025, 3, 30)), { year: 1446, month: 10, day: 1 });
    // jour par jour : aucun saut, aucun doublon, aller-retour exact
    let prev = H.toHijri(D(2018, 9, 11));
    for (let d = new Date(2018, 8, 12, 12); d < new Date(2038, 0, 1); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12)) {
      const h = H.toHijri(d);
      const same = h.year === prev.year && h.month === prev.month && h.day === prev.day + 1;
      const next = h.day === 1 && prev.day >= 29 && (h.month === prev.month + 1 || (h.month === 1 && prev.month === 12 && h.year === prev.year + 1));
      assert.ok(same || next, `${d.toDateString()} ${JSON.stringify(prev)} → ${JSON.stringify(h)}`);
      assert.equal(k(H.hijriToDate(h)), k(d));
      prev = h;
    }
    // le décalage utilisateur reste appliqué
    assert.equal(k(H.hijriToDate({ year: 1448, month: 9, day: 1 }, 1)), '2027-02-07');
  } finally {
    H.setHijriCalendar('tabular');
  }
});

// ——— Activation ———
test('activation auto : avant (J−3), question J−2, actif le 1er jour, jour N, après', () => {
  let st = R.ramadanStatus(D(2027, 2, 5), 0, P0, 'tabular');
  assert.equal(st.year, 1448);
  assert.equal(st.phase, 'before');
  assert.equal(st.daysUntil, 3);
  assert.equal(st.ask, null);
  assert.equal(st.active, false);
  st = R.ramadanStatus(D(2027, 2, 6), 0, P0, 'tabular');
  assert.equal(st.ask, 'start');
  st = R.ramadanStatus(D(2027, 2, 8), 0, P0, 'tabular');
  assert.equal(st.phase, 'during');
  assert.equal(st.day, 1);
  assert.equal(st.active, true);
  assert.equal(st.end, '2027-03-09');
  st = R.ramadanStatus(D(2027, 2, 27), 0, P0, 'tabular');
  assert.equal(st.day, 20);
  assert.equal(st.ask, null);
  st = R.ramadanStatus(D(2027, 3, 11), 0, P0, 'tabular');
  assert.equal(st.phase, 'after');
  assert.equal(st.active, false);
  st = R.ramadanStatus(D(2027, 3, 20), 0, P0, 'tabular');
  assert.equal(st.year, 1449);
  assert.equal(st.phase, 'before');
});
test('mode désactivé et forçage par année (observation locale)', () => {
  const off = { ...P0, mode: 'off' };
  assert.equal(R.ramadanStatus(D(2027, 2, 10), 0, off, 'tabular').active, false);
  assert.equal(R.ramadanStatus(D(2027, 2, 10), 0, off, 'tabular').ask, null);
  assert.equal(R.ramadanStatus(D(2027, 2, 10), 0, R.setOverride(off, 1448, 'on'), 'tabular').active, true);
  assert.equal(R.ramadanStatus(D(2027, 2, 10), 0, R.setOverride(P0, 1448, 'off'), 'tabular').active, false);
  // un forçage d’une autre année n’a pas d’effet
  assert.equal(R.ramadanStatus(D(2027, 2, 10), 0, R.setOverride(P0, 1447, 'off'), 'tabular').active, true);
});
test('confirmation locale : règle le décalage de toute l’app (source unique), sinon mémorise le début', () => {
  let r = R.confirmStart(P0, 0, 1448, '2027-02-09', 'tabular');
  assert.equal(r.offset, -1);
  assert.equal(r.inRange, true);
  let st = R.ramadanStatus(D(2027, 2, 9), r.offset, r.prefs, 'tabular');
  assert.equal(st.day, 1);
  assert.equal(st.source, 'confirmed');
  assert.equal(st.ask, null);
  assert.deepEqual(H.toHijri(D(2027, 2, 9), r.offset, 'tabular'), { year: 1448, month: 9, day: 1 });
  r = R.confirmStart(P0, 1, 1448, '2027-02-07', 'tabular');
  assert.equal(r.offset, 1);
  // hors de −2…+2 : décalage inchangé, début gardé pour le module Ramadan
  r = R.confirmStart(P0, 0, 1448, '2027-02-12', 'tabular');
  assert.equal(r.inRange, false);
  assert.equal(r.offset, 0);
  st = R.ramadanStatus(D(2027, 2, 12), 0, r.prefs, 'tabular');
  assert.equal(st.day, 1);
});
test('fin confirmée : question au 29e jour, 29 jours ensuite, puis « après »', () => {
  const st29 = R.ramadanStatus(D(2027, 3, 8), 0, P0, 'tabular');
  assert.equal(st29.day, 29);
  assert.equal(st29.ask, 'end');
  const p = R.confirmEnd(P0, 1448, '2027-03-08');
  const st = R.ramadanStatus(D(2027, 3, 8), 0, p, 'tabular');
  assert.equal(st.length, 29);
  assert.equal(st.ask, null);
  assert.equal(R.ramadanStatus(D(2027, 3, 9), 0, p, 'tabular').phase, 'after');
  assert.equal(R.ramadanStatus(D(2027, 3, 8), 0, R.dismiss(P0, '1448-end'), 'tabular').ask, null);
});
test('dix dernières nuits : la nuit N commence au soir du jour N−1 ; impaires 21, 23, 25, 27, 29', () => {
  const n = R.lastTenNights({ start: '2027-02-08', length: 30 });
  assert.equal(n.length, 10);
  assert.deepEqual(n.filter((x) => x.odd).map((x) => x.night), [21, 23, 25, 27, 29]);
  assert.equal(n[0].eve, '2027-02-27'); // jour 20
  assert.equal(R.lastTenNights({ start: '2027-02-08', length: 29 }).length, 9);
});

// ——— Compte à rebours ———
const rows = (d, f = [5, 30], m = [17, 30]) => [
  { key: 'fajr', time: new Date(d.getFullYear(), d.getMonth(), d.getDate(), ...f) },
  { key: 'maghrib', time: new Date(d.getFullYear(), d.getMonth(), d.getDate(), ...m) },
];
test('compte à rebours : suhur (Fajr − marge choisie, 0 par défaut) → iftar → suhur du lendemain', () => {
  const day = D(2027, 2, 10);
  const tom = D(2027, 2, 11);
  const fast = () => true;
  let e = R.nextFastEvent(D(2027, 2, 10, 3, 0), rows(day), rows(tom), 0, fast);
  assert.equal(e.kind, 'suhur');
  assert.equal(e.at.getHours() * 60 + e.at.getMinutes(), 5 * 60 + 30);
  e = R.nextFastEvent(D(2027, 2, 10, 3, 0), rows(day), rows(tom), 10, fast);
  assert.equal(e.at.getHours() * 60 + e.at.getMinutes(), 5 * 60 + 20);
  e = R.nextFastEvent(D(2027, 2, 10, 5, 25), rows(day), rows(tom), 10, fast);
  assert.equal(e.kind, 'iftar');
  assert.equal(R.hms(R.remainingMs(e.at, D(2027, 2, 10, 5, 25))), '12:05:00');
  e = R.nextFastEvent(D(2027, 2, 10, 18, 0), rows(day), rows(tom), 0, fast);
  assert.equal(e.kind, 'suhur');
  assert.equal(e.day, '2027-02-11');
  assert.equal(R.nextFastEvent(D(2027, 2, 10, 18, 0), rows(day), rows(tom), 0, (x) => x === '2027-02-10'), null);
});
test('changement d’heure (Europe/Zurich, 28.03.2027 et 31.10.2027) : temps restant = instants réels', () => {
  const place = { label: 'Genève', lat: 46.2044, lng: 6.1432, source: 'manual' };
  // printemps : 02:00 → 03:00, la nuit dure 1 h de moins
  const now = D(2027, 3, 27, 23, 0);
  const today = PR.computeDay(D(2027, 3, 27), place, 'MuslimWorldLeague', 'shafi');
  const tom = PR.computeDay(D(2027, 3, 28), place, 'MuslimWorldLeague', 'shafi');
  const e = R.nextFastEvent(now, today, tom, 0, () => true);
  assert.equal(e.kind, 'suhur');
  const f = e.at;
  const wall = (f.getHours() + 24 - 23) * 3600000 + f.getMinutes() * 60000 + f.getSeconds() * 1000 + f.getMilliseconds();
  assert.equal(R.remainingMs(f, now), wall - 3600000, 'une heure de moins que l’écart « à l’horloge »');
  assert.equal(f.getTimezoneOffset(), -120);
  assert.equal(now.getTimezoneOffset(), -60);
  // automne : 03:00 → 02:00, la nuit dure 1 h de plus
  const now2 = D(2027, 10, 30, 23, 0);
  const t2 = PR.computeDay(D(2027, 10, 31), place, 'MuslimWorldLeague', 'shafi');
  const e2 = R.nextFastEvent(now2, PR.computeDay(D(2027, 10, 30), place, 'MuslimWorldLeague', 'shafi'), t2, 0, () => true);
  const f2 = e2.at;
  const wall2 = (f2.getHours() + 1) * 3600000 + f2.getMinutes() * 60000 + f2.getSeconds() * 1000 + f2.getMilliseconds();
  assert.equal(R.remainingMs(f2, now2), wall2 + 3600000);
  // jours civils comptés sans dérive
  assert.equal(R.daysBetween('2027-03-27', '2027-03-29'), 2);
  assert.equal(R.addDays('2027-03-27', 1), '2027-03-28');
  assert.equal(R.addDays('2027-10-30', 2), '2027-11-01');
});
test('activité en direct : suhur = Fajr − marge choisie ; sans marge = Fajr ; hors mode actif = prière', () => {
  const names = { title: 'Prochaine', place: 'X', names: { fajr: 'Fajr', dhuhr: 'D', asr: 'A', maghrib: 'Maghrib', isha: 'I' }, namesAr: { fajr: '', dhuhr: '', asr: '', maghrib: '', isha: '' }, suhur: 'Fin du suhur', iftar: 'Iftar', suhurMargin: 'Fin du suhur · 10 min' };
  const day = D(2027, 2, 10);
  const now = D(2027, 2, 10, 4, 0);
  let a = W.liveActivityFor(rows(day), rows(D(2027, 2, 11)), now, names, { on: true, hijriMonth: 9, active: true, imsakMin: 10 });
  assert.equal(a.kind, 'suhur');
  assert.equal(a.time, '05:20');
  assert.equal(a.name, 'Fin du suhur · 10 min');
  a = W.liveActivityFor(rows(day), rows(D(2027, 2, 11)), now, names, { on: true, hijriMonth: 9, active: true });
  assert.equal(a.time, '05:30');
  assert.equal(a.name, 'Fin du suhur');
  a = W.liveActivityFor(rows(day), rows(D(2027, 2, 11)), now, names, { on: true, hijriMonth: 9, active: false, imsakMin: 10 });
  assert.equal(a.kind, 'prayer');
  assert.equal(a.time, '05:30');
  // entre Fajr − marge et Fajr : le repère suivant est déjà le Maghrib (iftar), hors fenêtre de 2 h → rien
  a = W.liveActivityFor(rows(day), rows(D(2027, 2, 11)), D(2027, 2, 10, 5, 25), names, { on: true, hijriMonth: 9, active: true, imsakMin: 10 });
  assert.equal(a, null);
});

// ——— Suivis privés ———
test('suivi du jeûne : marques réversibles, dispense neutre automatique, rattrapage privé, aucune série', () => {
  const st = { year: 1448, start: '2027-02-08', length: 30 };
  let p = R.markFast(P0, 1448, '2027-02-08', 'fasted');
  p = R.markFast(p, 1448, '2027-02-09', 'missed');
  p = R.markFast(p, 1448, '2027-02-10', 'excused');
  p = R.markFast(p, 1448, '2027-02-11', 'fasted');
  p = R.markFast(p, 1448, '2027-02-11', 'fasted'); // re-toucher efface
  const neutral = (d) => d === '2027-02-12' || d === '2027-02-13';
  let s = R.fastSummary(p, st, '2027-02-14', neutral);
  assert.deepEqual({ ...s }, { fasted: 1, excused: 1, missed: 1, dispense: 2, unmarked: 2, toMakeUp: 4, tarawih: 0 });
  // une marque explicite prime sur la dispense
  p = R.markFast(p, 1448, '2027-02-12', 'fasted');
  s = R.fastSummary({ ...p, makeupDone: 10 }, st, '2027-02-14', neutral);
  assert.equal(s.fasted, 2);
  assert.equal(s.toMakeUp, 0, 'jamais négatif');
  assert.equal('streak' in R, false, 'pas de série dans le suivi du jeûne');
  assert.equal(P0.makeup, false, 'suivi du rattrapage désactivé par défaut');
});
test('tarawih : case privée par nuit, réversible', () => {
  let p = R.toggleTarawih(P0, 1448, '2027-02-08');
  p = R.toggleTarawih(p, 1448, '2027-02-09');
  p = R.toggleTarawih(p, 1448, '2027-02-09');
  assert.equal(R.fastSummary(p, { year: 1448, start: '2027-02-08', length: 30 }, '2027-02-10', () => false).tarawih, 1);
  assert.deepEqual(P0.log, {}, 'état par défaut non modifié');
});
test('zakat al-fitr : total seulement depuis un montant saisi clair ; aucun montant par défaut', () => {
  assert.equal(P0.zakat.amount, '');
  assert.equal(R.zakatTotal(P0.zakat), null);
  assert.deepEqual(R.zakatTotal({ ...P0.zakat, amount: '12 CHF', people: 3 }), { value: '36', unit: 'CHF' });
  assert.deepEqual(R.zakatTotal({ ...P0.zakat, amount: '7,50 €', people: 2 }), { value: '15', unit: '€' });
  assert.deepEqual(R.zakatTotal({ ...P0.zakat, amount: '7.25', people: 3 }), { value: '21.75', unit: '' });
  assert.equal(R.zakatTotal({ ...P0.zakat, amount: 'environ 12', people: 3 }), null);
});
test('normalisation : valeurs inconnues → défauts, marge d’imsak 0, rappels désactivés', () => {
  const n = R.normalizeRamadan({ imsakMin: 'x', notif: { suhur: 'oui' }, zakat: { date: 'demain' } });
  assert.equal(n.imsakMin, 0);
  assert.equal(n.notif.suhur, false);
  assert.equal(n.notif.iftar, false);
  assert.equal(n.zakat.date, null);
  assert.equal(R.normalizeRamadan(null).mode, 'auto');
});

// ——— Notifications (planificateur glissant Pass 1) ———
const HH = { fajr: [5, 30], sunrise: [7, 5], dhuhr: [12, 20], asr: [15, 0], maghrib: [17, 30], isha: [19, 0] };
const compute = (d) => Object.entries(HH).map(([key, [h, m]]) => ({ key, time: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m) }));
const L = { prayer: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }, place: 'Lieu', atTime: 'Heure', inMin: (n) => `dans ${n} min`, kahfTitle: 'Kahf', kahfBody: '', jumuaTitle: 'Jumua', jumuaBody: '', morningTitle: 'AM', eveningTitle: 'PM', adhkarBody: '', wirdMorning: 'WA', wirdEvening: 'WP', wazifa: 'Waz', hailala: 'Hail', wirdBody: '', quranTitle: 'Coran', quranBody: '', pausedTitle: 'Pause', pausedBody: '', suhurTitle: (t) => `Suhur · fin à ${t}`, suhurBody: (f) => `Fajr ${f}`, iftarTitle: 'Iftar', iftarBody: 'Maghrib', zakatTitle: 'Zakat al-fitr', zakatBody: '' };
const st = R.ramadanStatus(D(2027, 2, 10), 0, P0, 'tabular');
const fastAll = { isFastDay: R.fastDayPredicate(st, P0), suhur: true, suhurLead: 45, imsakMin: 0, iftar: true, quietOverride: false };
const nowN = D(2027, 2, 10, 2, 0);
const heavy = { ...P.DEFAULT_NOTIF, before: 10, adhkar: true, wird: true, friday: true, quran: 'isha', recap: true };
test('budget : suhur prioritaire comme les adhans sur 8 jours, ≤ 64 même avec toutes les options', () => {
  const p = P.buildPlan(nowN, compute, heavy, L, 63, 30, undefined, fastAll);
  assert.ok(p.length <= 64, String(p.length));
  const suhur = p.filter((e) => e.kind === 'suhur');
  assert.equal(suhur.length >= P.PRIORITY_DAYS, true, `suhur ${suhur.length}`);
  for (let i = 0; i < P.PRIORITY_DAYS; i++) {
    const d = new Date(2027, 1, 10 + i);
    assert.ok(suhur.some((e) => e.date.toDateString() === d.toDateString()), 'suhur du jour ' + i);
    assert.ok(p.some((e) => e.id === `${k(d)}-maghrib` && e.title.startsWith('Iftar · ')), 'iftar = adhan du Maghrib renommé');
  }
  assert.equal(suhur[0].title, 'Suhur · fin à 05:30');
  assert.equal(suhur[0].date.getHours() * 60 + suhur[0].date.getMinutes(), 4 * 60 + 45);
  assert.equal(p.filter((e) => e.kind === 'iftar').length, 0, 'aucun créneau de plus quand l’adhan du Maghrib est actif');
});
test('iftar sans adhan du Maghrib : un rappel « iftar » dédié ; marge d’imsak appliquée au suhur', () => {
  const prefs = { ...P.DEFAULT_NOTIF, prayers: { ...P.DEFAULT_NOTIF.prayers, maghrib: false } };
  const ev = P.eventsForDay(D(2027, 2, 12), compute(D(2027, 2, 12)), prefs, L, { ...fastAll, imsakMin: 10, suhurLead: 30 });
  const i = ev.find((e) => e.kind === 'iftar');
  assert.equal(i.title, 'Iftar · Maghrib');
  const s = ev.find((e) => e.kind === 'suhur');
  assert.equal(s.title, 'Suhur · fin à 05:20');
  assert.equal(s.date.getHours() * 60 + s.date.getMinutes(), 4 * 60 + 50);
});
test('hors Ramadan : aucun suhur / iftar ; mode désactivé : rien non plus', () => {
  const p = P.buildPlan(D(2027, 3, 20, 2), compute, P.DEFAULT_NOTIF, L, 63, 30, undefined, { ...fastAll, isFastDay: R.fastDayPredicate(R.ramadanStatus(D(2027, 3, 20), 0, P0, 'tabular'), P0) });
  assert.equal(p.filter((e) => e.kind === 'suhur' || e.title.startsWith('Iftar')).length, 0);
  const off = { ...P0, mode: 'off' };
  const p2 = P.buildPlan(nowN, compute, P.DEFAULT_NOTIF, L, 63, 30, undefined, { ...fastAll, isFastDay: R.fastDayPredicate(st, off) });
  assert.equal(p2.filter((e) => e.kind === 'suhur').length, 0);
});
test('heures calmes respectées (suhur 04:45 retiré) ; autorisation explicite → conservé', () => {
  const q = { ...P.DEFAULT_NOTIF, quiet: { on: true, from: '22:30', to: '06:30' } };
  const a = P.eventsForDay(D(2027, 2, 12), compute(D(2027, 2, 12)), q, L, fastAll);
  assert.equal(a.filter((e) => e.kind === 'suhur').length, 0);
  assert.ok(a.some((e) => e.id.endsWith('-fajr')), 'les adhans restent');
  const b = P.eventsForDay(D(2027, 2, 12), compute(D(2027, 2, 12)), q, L, { ...fastAll, quietOverride: true });
  assert.equal(b.filter((e) => e.kind === 'suhur').length, 1);
});
test('mode dispense : suhur / iftar retirés avec les rappels de prière', () => {
  const p = P.buildPlan(nowN, compute, P.DEFAULT_NOTIF, L, 63, 30, (d) => (d.getDate() === 11 ? 'prayers' : 'none'), fastAll);
  assert.equal(p.filter((e) => e.date.getDate() === 11 && (e.kind === 'suhur' || e.kind === 'prayer')).length, 0);
  assert.ok(p.some((e) => e.date.getDate() === 12 && e.kind === 'suhur'));
});
test('zakat al-fitr : un seul rappel, le jour choisi à 10:00, rappel secondaire', () => {
  const p = P.buildPlan(nowN, compute, P.DEFAULT_NOTIF, L, 63, 30, undefined, { ...fastAll, zakatDay: '2027-02-14' });
  const z = p.filter((e) => e.kind === 'zakat');
  assert.equal(z.length, 1);
  assert.equal(z[0].date.getDate(), 14);
  assert.equal(z[0].date.getHours(), 10);
  assert.equal(P.isPriority(z[0]), false);
});

console.log(`\nRamadan : ${ok} tests OK`);
