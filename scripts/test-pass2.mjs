// Passe 2 (brief §5, §7, §8) : adhkar par moment (textes existants seulement), centre de notifications
// (heures calmes, bilan), objectifs et série douce, données des widgets.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const M = await loadLib(['adhkar', 'duas', 'review-sheet'], 'pass2');
const A = M.adhkar, D = M.duas, R = M['review-sheet'];
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

console.log(`\n${ok} tests Passe 2 OK`);
