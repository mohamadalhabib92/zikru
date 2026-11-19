// Tests du journal de gratitude (bien-être) : 3 bienfaits max par soir, pastilles, texte libre borné,
// normalisation de données abîmées, effacement, clôture, résumé SANS série, et rappel du soir
// (désactivé par défaut, heures calmes et pause respectées, budget de notifications ≤ 64).
process.env.TZ = 'Europe/Zurich';
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { gratitude: G, 'notify-plan': P } = await loadLib(['gratitude', 'notify-plan'], 'gratitude');
let ok = 0;
const test = (n, f) => {
  f();
  ok++;
  console.log('✓', n);
};
const E = G.EMPTY_JOURNAL;
const T = '2027-03-01';

test('clé de stockage locale « be-gratitude » et constantes', () => {
  assert.equal(G.GRATITUDE_KEY, 'be-gratitude');
  assert.equal(G.MAX_PER_DAY, 3);
  assert.equal(G.CHIPS.length, 12);
  assert.equal(new Set(G.CHIPS.map((c) => c.id)).size, 12);
  assert.equal(G.dayKey(new Date(2027, 2, 1, 23, 59)), T);
});
test('au plus 3 bienfaits par soir ; le 4e est refusé (même objet renvoyé)', () => {
  let j = E;
  for (const k of ['health', 'family', 'prayer']) j = G.toggleChip(j, T, k);
  assert.equal(G.blessingsOf(j, T).length, 3);
  assert.equal(G.isFull(j, T), true);
  assert.equal(G.addBlessing(j, T, { t: 'encore' }), j);
  assert.equal(G.toggleChip(j, T, 'food'), j);
});
test('pastille : un geste ajoute, un second retire ; pas de doublon', () => {
  let j = G.toggleChip(E, T, 'quran');
  assert.equal(G.hasChip(j, T, 'quran'), true);
  assert.equal(G.addBlessing(j, T, { k: 'quran' }), j);
  j = G.toggleChip(j, T, 'quran');
  assert.equal(G.hasChip(j, T, 'quran'), false);
  assert.deepEqual(j.days, {});
});
test('texte libre : espaces nettoyés, borné à 140, vide refusé', () => {
  let j = G.addBlessing(E, T, { t: '   un   appel   de ma mère  ' });
  assert.equal(G.blessingsOf(j, T)[0].t, 'un appel de ma mère');
  j = G.addBlessing(j, T, { t: 'x'.repeat(500) });
  assert.equal(G.blessingsOf(j, T)[1].t.length, G.MAX_TEXT);
  assert.equal(G.addBlessing(j, T, { t: '   ' }), j);
  assert.equal(G.addBlessing(j, 'pas-une-date', { t: 'a' }), j);
});
test('normalisation : données abîmées tolérées (clé inconnue, jour invalide, > 3, clôture orpheline)', () => {
  const n = G.normalizeJournal({ days: { [T]: [{ k: 'health' }, { k: 'inconnu' }, { t: 'a' }, { t: 'b' }, { t: 'c' }], nope: [{ t: 'x' }], '2027-03-02': 'x' }, closed: { [T]: true, '2027-01-01': true } });
  assert.deepEqual(n.days[T], [{ k: 'health' }, { t: 'a' }, { t: 'b' }]);
  assert.deepEqual(Object.keys(n.days), [T]);
  assert.deepEqual(n.closed, { [T]: true });
  assert.deepEqual(G.normalizeJournal(null), { v: 1, days: {} });
  assert.deepEqual(G.normalizeJournal('x'), { v: 1, days: {} });
});
test('effacer : un bienfait, un soir (et sa clôture), tout', () => {
  let j = G.addBlessing(G.addBlessing(E, T, { t: 'a' }), T, { k: 'rest' });
  j = G.removeBlessing(j, T, 0);
  assert.deepEqual(G.blessingsOf(j, T), [{ k: 'rest' }]);
  j = G.closeDay(j, T);
  j = G.deleteDay(j, T);
  assert.deepEqual(j, { v: 1, days: {} });
  assert.equal(G.removeBlessing(j, T, 5), j);
});
test('clôture « al-ḥamdu li-llāh » : seulement avec au moins un bienfait ; réouverture possible', () => {
  assert.equal(G.closeDay(E, T), E);
  let j = G.closeDay(G.toggleChip(E, T, 'ease'), T);
  assert.equal(G.isClosed(j, T), true);
  j = G.reopenDay(j, T);
  assert.equal(G.isClosed(j, T), false);
  assert.equal(j.closed, undefined);
});
test('résumé doux : soirs et bienfaits (7 j et total), AUCUNE série', () => {
  let j = E;
  for (const d of ['2027-02-20', '2027-02-24', '2027-02-28', T]) j = G.toggleChip(j, d, 'health');
  j = G.addBlessing(j, T, { t: 'soleil' });
  const s = G.summary(j, T);
  assert.deepEqual(s, { evenings: 4, blessings: 5, weekEvenings: 3, weekBlessings: 4 });
  assert.ok(!Object.keys(s).some((k) => /streak|serie|série/i.test(k)));
  assert.deepEqual(G.notedDays(j), [T, '2027-02-28', '2027-02-24', '2027-02-20']);
  assert.deepEqual(G.topChips(j, 1), [{ k: 'health', count: 4 }]);
});

// ——— Rappel du soir (planificateur Pass 1) ———
const HH = { fajr: [5, 30], sunrise: [7, 5], dhuhr: [12, 20], asr: [15, 0], maghrib: [18, 30], isha: [20, 0] };
const compute = (d) => Object.entries(HH).map(([key, [h, m]]) => ({ key, time: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m) }));
const L = { prayer: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }, place: 'Lieu', atTime: 'Heure', inMin: (n) => `dans ${n} min`, kahfTitle: 'Kahf', kahfBody: '', jumuaTitle: 'Jumua', jumuaBody: '', morningTitle: 'AM', eveningTitle: 'PM', adhkarBody: '', wirdMorning: 'WA', wirdEvening: 'WP', wazifa: 'Waz', hailala: 'Hail', wirdBody: '', quranTitle: 'Coran', quranBody: '', pausedTitle: 'Pause', pausedBody: '', gratTitle: 'Gratitude du soir', gratBody: 'b' };
const now = new Date(2027, 2, 1, 8, 0);
const grat = (p) => p.filter((e) => e.kind === 'gratitude');

test('rappel désactivé par défaut : aucun événement « gratitude »', () => {
  assert.deepEqual(P.DEFAULT_NOTIF.gratitude, { on: false, at: '21:00' });
  assert.equal(grat(P.buildPlan(now, compute, P.DEFAULT_NOTIF, L)).length, 0);
});
test('activé : un rappel par soir à l’heure choisie, lien vers /bien-etre?s=gratitude', () => {
  const p = grat(P.buildPlan(now, compute, { ...P.DEFAULT_NOTIF, gratitude: { on: true, at: '21:30' } }, L));
  assert.ok(p.length >= 1);
  assert.equal(p[0].date.getHours(), 21);
  assert.equal(p[0].date.getMinutes(), 30);
  assert.equal(p[0].url, '/bien-etre?s=gratitude');
  assert.equal(new Set(p.map((e) => e.id)).size, p.length);
});
test('heure invalide ignorée', () => {
  for (const at of ['25:00', '21:75', 'x', ''])
    assert.equal(grat(P.buildPlan(now, compute, { ...P.DEFAULT_NOTIF, gratitude: { on: true, at } }, L)).length, 0, at);
});
test('heures calmes respectées (20:30 → 06:30) ; la pause « tout » le retire', () => {
  const prefs = { ...P.DEFAULT_NOTIF, gratitude: { on: true, at: '21:00' }, quiet: { on: true, from: '20:30', to: '06:30' } };
  assert.equal(grat(P.buildPlan(now, compute, prefs, L)).length, 0);
  const ev = P.eventsForDay(now, compute(now), { ...prefs, quiet: undefined }, L);
  assert.equal(grat(ev).length, 1);
  assert.equal(grat(P.applyQuiet(ev, prefs.quiet)).length, 0);
  assert.equal(P.applyPause(ev, 'all').length, 0);
});
test('budget : ≤ 64 notifications même avec toutes les options + gratitude', () => {
  const heavy = { ...P.DEFAULT_NOTIF, before: 10, adhkar: true, wird: true, friday: true, quran: 'isha', recap: true, gratitude: { on: true, at: '22:00' } };
  const p = P.buildPlan(now, compute, heavy, L);
  assert.ok(p.length <= 64, String(p.length));
  assert.equal(p.filter((e) => e.kind === 'prayer').length >= 8 * 5 - 1, true);
});

console.log(`test-gratitude : ${ok} tests OK`);
