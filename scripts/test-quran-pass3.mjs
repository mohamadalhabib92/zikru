// Tests Passe 3 (Coran) : répétition A-B, lecture continue d’une sourate à l’autre, minuterie de sommeil,
// comptabilité des téléchargements audio, normalisation de la translittération, plan khatma Ramadan / personnalisé,
// registre des licences.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { recitation: R, 'recitation-queue': Q, 'sleep-timer': T, 'audio-dl-core': D, 'translit-norm': N, khatma: K, 'quran-licenses': Lc, dates } = await loadLib(
  ['recitation', 'recitation-queue', 'sleep-timer', 'audio-dl-core', 'translit-norm', 'khatma', 'quran-licenses', 'dates'],
  'pass3',
);
let ok = 0;
const test = async (n, f) => {
  await f();
  ok++;
  console.log('✓', n);
};

// ——— A-B ———
await test('A-B : bornes remises dans l’ordre et dans la sourate', () => {
  assert.deepEqual(R.abRange(1, 5, 2), { s: 1, a: 2, b: 5 });
  assert.deepEqual(R.abRange(1, 0, 99), { s: 1, a: 1, b: 7 });
  assert.deepEqual(R.abRange(112, 3, 3), { s: 112, a: 3, b: 3 });
});
await test('A-B ×3 : la plage 2..4 jouée 3 fois, dans l’ordre, chaque verset 1 fois', () => {
  const { queue, loop } = R.abQueue(2, 2, 4, 3);
  assert.equal(loop, false);
  assert.equal(queue.length, 9);
  assert.deepEqual(queue.map((x) => x.a), [2, 3, 4, 2, 3, 4, 2, 3, 4]);
  assert.deepEqual(queue.map((x) => x.pass), [1, 1, 1, 2, 2, 2, 3, 3, 3]);
  // la file s’arrête après le dernier passage
  assert.equal(Q.advance(queue, queue.length - 1, false), null);
});
await test('A-B ∞ : une passe, en boucle (retour à A après B)', () => {
  const { queue, loop } = R.abQueue(36, 1, 3, 0);
  assert.equal(loop, true);
  assert.equal(queue.length, 3);
  const nx = Q.advance(queue, 2, true);
  assert.equal(nx.next, 0);
});
await test('A-B : chaque verset ×2 et plage ×2 ; plafonds (99 passages, 20 répétitions)', () => {
  const { queue } = R.abQueue(1, 1, 2, 2, 2);
  assert.deepEqual(queue.map((x) => `${x.a}.${x.rep}`), ['1.1', '1.2', '2.1', '2.2', '1.1', '1.2', '2.1', '2.2']);
  assert.equal(R.abQueue(1, 1, 1, 500).queue.length, 99);
  assert.equal(R.abQueue(1, 1, 1, 1, 50).queue.length, 20);
});
await test('Lecture continue : fin d’al-Fātiḥa → al-Baqara 1..286 ; milieu de sourate ou an-Nās → rien', () => {
  const q = R.nextSurahQueue({ s: 1, a: 7, rep: 1, pass: 1 });
  assert.equal(q.length, 286);
  assert.deepEqual([q[0].s, q[0].a, q[285].a], [2, 1, 286]);
  assert.equal(R.nextSurahQueue({ s: 1, a: 5, rep: 1, pass: 1 }), null);
  assert.equal(R.nextSurahQueue({ s: 114, a: 6, rep: 1, pass: 1 }), null);
  // trois sourates d’affilée (112 → 113 → 114)
  let last = { s: 111, a: 5, rep: 1, pass: 1 }, seen = [];
  for (let i = 0; i < 3; i++) {
    const nq = R.nextSurahQueue(last);
    seen.push(nq[0].s);
    last = nq[nq.length - 1];
  }
  assert.deepEqual(seen, [112, 113, 114]);
});

// ——— Minuterie ———
await test('Minuterie : 15 min, échéance, temps restant, arrêt', () => {
  const t0 = 1_000_000;
  const sl = T.armSleep(15, t0, 2);
  assert.equal(sl.kind, 'at');
  assert.equal(T.sleepLeft(sl, t0 + 60_000), 14 * 60_000);
  assert.equal(T.sleepDue(sl, t0 + 15 * 60_000 - 1, { s: 2 }), false);
  assert.equal(T.sleepDue(sl, t0 + 15 * 60_000, { s: 2 }), true);
  assert.equal(T.armSleep('off', t0, 2).kind, 'off');
  assert.equal(T.sleepDue(T.SLEEP_OFF, t0 * 9, null), false);
  assert.equal(T.armSleep(0, t0, 2).kind, 'off');
});
await test('Minuterie « fin de sourate » : se déclenche quand la lecture passe à la sourate suivante', () => {
  const sl = T.armSleep('surah', 0, 18);
  assert.deepEqual(sl, { kind: 'surah', s: 18 });
  assert.equal(T.sleepDue(sl, 0, { s: 18 }), false);
  assert.equal(T.sleepDue(sl, 0, { s: 19 }), true);
  assert.equal(T.armSleep('surah', 0, null).kind, 'off');
  assert.equal(T.sleepLeft(sl, 0), null);
});
await test('Minuterie : affichage m:ss / h:mm:ss', () => {
  assert.equal(T.fmtClock(65_000), '1:05');
  assert.equal(T.fmtClock(3_600_000 + 61_000), '1:01:01');
  assert.equal(T.fmtClock(-5), '0:00');
});

// ——— Téléchargements ———
await test('Téléchargements : versets ajoutés dans l’ordre, octets cumulés, pas de double comptage', () => {
  let m = {};
  m = D.addVerse(m, 'alafasy', 1, 1, 7, 100, 1);
  m = D.addVerse(m, 'alafasy', 1, 2, 7, 200, 2);
  m = D.addVerse(m, 'alafasy', 1, 2, 7, 200, 3); // doublon ignoré
  m = D.addVerse(m, 'alafasy', 1, 5, 7, 999, 4); // hors ordre ignoré
  assert.deepEqual(D.entry(m, 'alafasy', 1), { v: 2, total: 7, bytes: 300, at: 2 });
  assert.equal(D.isLocal(m, 'alafasy', 1, 2), true);
  assert.equal(D.isLocal(m, 'alafasy', 1, 3), false);
  assert.equal(D.isComplete(D.entry(m, 'alafasy', 1)), false);
  for (let a = 3; a <= 7; a++) m = D.addVerse(m, 'alafasy', 1, a, 7, 10, 5);
  assert.equal(D.isComplete(D.entry(m, 'alafasy', 1)), true);
  assert.equal(D.reciterBytes(m, 'alafasy'), 350);
});
await test('Téléchargements : totaux par récitateur, suppression d’une sourate et d’un récitateur', () => {
  let m = {};
  for (let a = 1; a <= 4; a++) m = D.addVerse(m, 'husary', 112, a, 4, 1000, 1);
  m = D.addVerse(m, 'husary', 113, 1, 5, 500, 1);
  m = D.addVerse(m, 'alafasy', 114, 1, 6, 250, 1);
  assert.deepEqual(D.reciterSummary(m, 'husary'), { complete: 1, partial: 1, bytes: 4500 });
  assert.equal(D.totalBytes(m), 4750);
  m = D.removeSurah(m, 'husary', 113);
  assert.equal(D.totalBytes(m), 4250);
  m = D.removeReciter(m, 'husary');
  assert.equal(D.totalBytes(m), 250);
  m = D.removeSurah(m, 'alafasy', 114);
  assert.deepEqual(m, {});
});
await test('Téléchargements : taille mesurée, reste à télécharger, sourates non mesurées', () => {
  const sizes = { alafasy: { 1: 1000, 2: 5000 } };
  let m = D.addVerse({}, 'alafasy', 1, 1, 7, 300, 1);
  assert.equal(D.remainingBytes(m, sizes, 'alafasy', 1), 700);
  assert.equal(D.remainingBytes(m, sizes, 'alafasy', 2), 5000);
  assert.equal(D.remainingBytes(m, sizes, 'alafasy', 3), null);
  assert.deepEqual(D.sizeOf(sizes, 'alafasy', [1, 2, 3]), { bytes: 6000, unknown: 1 });
  assert.equal(D.verseFile(2, 255), '002255.mp3');
});
await test('Téléchargements : tailles lisibles fr / en / ar', () => {
  assert.equal(D.formatBytes(512, 'fr'), '512 o');
  assert.equal(D.formatBytes(1_234_567, 'fr').replace(/\s/g, ' '), '1,2 Mo');
  assert.equal(D.formatBytes(1_234_567, 'en'), '1.2 MB');
  assert.equal(D.formatBytes(2_500_000_000, 'en'), '2.5 GB');
  assert.equal(D.formatBytes(345_000_000, 'en'), '345 MB');
  assert.match(D.formatBytes(1_234_567, 'ar'), /م\.ب$/);
});
await test('mapLimit : ordre conservé, au plus n tâches en parallèle, arrêt demandé', async () => {
  let live = 0, peak = 0;
  const out = await D.mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
    live++;
    peak = Math.max(peak, live);
    await new Promise((r) => setTimeout(r, 5));
    live--;
    return x * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14]);
  assert.ok(peak <= 3);
  let n = 0;
  await D.mapLimit([1, 2, 3, 4, 5], 1, async () => void n++, () => n >= 2);
  assert.equal(n, 2);
});

// ——— Recherche par translittération ———
const TL = {
  '1:2': "Alhamdu lillaahi Rabbil 'aalameen",
  '1:5': "Iyyaaka na'budu wa lyyaaka nasta'een",
  '2:255': "Allahu laaa ilaaha illaa Huwal Haiyul Qaiyoom; laa taakhuzuhoo sinatunw wa laa nawm",
  '55:13': "Fabi ayyi aalaaa'i Rabbikumaa tukazzibaan",
  '112:1': 'Qul huwal laahu ahad',
  '114:1': "Qul a'uzu birabbin naas",
};
const keys = Object.fromEntries(Object.entries(TL).map(([k, v]) => [k, N.tlKey(v)]));
const find = (q) => Object.keys(keys).filter((k) => N.tlMatch(keys[k], q) > 0);
await test('Translittération : graphies courantes retrouvent le bon verset', () => {
  assert.deepEqual(find('alhamdulillah rabbil alamin'), ['1:2']);
  assert.deepEqual(find('Al-Ḥamdu lillāhi'), ['1:2']);
  assert.deepEqual(find('iyyaka nabudu'), ['1:5']);
  assert.deepEqual(find('al hayyul qayyum'), ['2:255']);
  assert.deepEqual(find('fabi ayyi ala i rabbikuma tukadhiban'), ['55:13']);
  assert.deepEqual(find('qul a’udhu bi rabbin nas'), ['114:1']);
  assert.deepEqual(find('qul huwa llahu ahad'), ['112:1']);
});
await test('Translittération : expression entière (2) avant mots épars (1) ; requêtes trop courtes ignorées', () => {
  assert.equal(N.tlMatch(keys['112:1'], 'qul huwal'), 2);
  assert.equal(N.tlMatch(keys['112:1'], 'ahad qul'), 1);
  assert.equal(N.tlMatch(keys['112:1'], 'q'), 0);
  // doublons à la jonction des mots : « huwa allahu » ≈ « huwal laahu »
  assert.equal(N.tlMatch(keys['112:1'], 'qul huwa allahu ahad'), 2);
  assert.equal(N.squashTl("Rahmaanir Raheem"), 'rahmanir rahim');
});

// ——— Khatma ———
await test('Khatma 30 jours et personnalisée (45 j depuis la p. 302) : pages couvertes exactement une fois', () => {
  for (const [days, from] of [[30, 1], [45, 302], [1, 1], [365, 1]]) {
    const k = K.newKhatma('2026-11-01', days, from);
    let covered = 0;
    for (let d = 0; d < days; d++) {
      const t = K.khatmaStatus(k, dates.addDays('2026-11-01', d)).today;
      covered += t.to - t.from + 1;
    }
    assert.equal(covered, 604 - from + 1, `${days} j / p. ${from}`);
  }
});
await test('Khatma Ramadan : 1er Ramadan 1448 ≈ 8 février 2027 (tabulaire), 29 ou 30 jours, décalage appliqué', () => {
  const p = K.ramadanPlan('2026-10-31', 0);
  assert.equal(p.year, 1448);
  assert.equal(p.ongoing, false);
  assert.ok(['2027-02-07', '2027-02-08', '2027-02-09'].includes(p.start), p.start);
  assert.ok(p.days === 29 || p.days === 30);
  const p1 = K.ramadanPlan('2026-10-31', 1);
  assert.equal(dates.daysBetween(p1.start, p.start), 1);
  // pendant Ramadan : d’aujourd’hui à la fin du mois
  const mid = dates.addDays(p.start, 10);
  const q = K.ramadanPlan(mid, 0);
  assert.equal(q.ongoing, true);
  assert.equal(q.start, mid);
  assert.equal(q.days, p.days - 10);
});
await test('Khatma programmée : avant le début, pas de retard compté ; démarre au jour J', () => {
  const p = K.ramadanPlan('2026-10-31', 0);
  const k = K.newKhatma(p.start, p.days);
  const before = K.khatmaStatus(k, '2026-10-31');
  assert.equal(before.notStarted, true);
  assert.equal(before.startsIn, dates.daysBetween('2026-10-31', p.start));
  assert.equal(before.delta, 0);
  const d1 = K.khatmaStatus(k, p.start);
  assert.equal(d1.notStarted, false);
  assert.equal(d1.day, 1);
  assert.ok(d1.delta < 0);
});

// ——— Licences ———
await test('Licences : seules les sources vérifiées peuvent être incrustées dans une image ; les autres renvoient au TODO', () => {
  assert.equal(Lc.canEmbedTranslation('en.pickthall'), true);
  for (const id of ['fr.hamidullah', 'de.bubenheim', 'ar.muyassar', 'en.transliteration']) {
    assert.equal(Lc.canEmbedTranslation(id), false, id);
    assert.equal(Lc.translationSource(id).licence, 'YOUR_QURAN_TRANSLATIONS_LICENSES');
  }
  assert.equal(Lc.canEmbedTranslation('xx.unknown'), false);
  assert.equal(Lc.QURAN_TEXT_SOURCE.status, 'verified');
});

console.log(`test-quran-pass3 : ${ok} tests OK`);
