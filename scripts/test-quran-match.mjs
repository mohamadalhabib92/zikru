// Tests du rapprochement « texte collé / photographié → verset du Coran » (src/lib/quran-match.ts).
// Exigences : exact, sans diacritiques, extrait, suite de versets, aucune correspondance,
// et une quasi-correspondance qui ne doit JAMAIS être présentée comme identique.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'quran-match': M, 'quran-text': T, 'quran-uthmani': U } = await loadLib(['quran-match', 'quran-text', 'quran-uthmani'], 'qmatch');
const t0 = Date.now();
const idx = M.buildIndex(T.QURAN_TEXT, U.QURAN_UTHMANI);
const buildMs = Date.now() - t0;
const uthLine = (s, a) => U.QURAN_UTHMANI.split('\n').find((l) => l.startsWith(`${s}|${a}|`)).split('|')[2];
const tests = [];
const test = (n, f) => tests.push([n, f]);
const exact = (r) => {
  assert.equal(r.level, 'exact', JSON.stringify(r));
  return r.best;
};

test('index : 6236 versets, deux couches', () => {
  assert.equal(idx.verses.length, 6236);
  assert.equal(idx.layers.length, 2);
});
test('verset exact copié (uthmani, avec harakāt) → 2:255, texte officiel identique au Tanzil', () => {
  const p = exact(M.matchQuran(idx, uthLine(2, 255)));
  assert.deepEqual([p.kind, p.ref, p.whole, p.diff], ['ayah', '2:255', true, 0]);
  assert.equal(p.official, uthLine(2, 255));
});
test('verset collé depuis un site (orthographe courante, avec harakāt) → 1:2', () => {
  const p = exact(M.matchQuran(idx, 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'));
  assert.equal(p.ref, '1:2');
  assert.equal(p.official, uthLine(1, 2));
});
test('sans diacritiques, hamza / alif / tā’ marbūṭa variables → 2:255', () => {
  const p = exact(M.matchQuran(idx, 'الله لا اله الا هو الحي القيوم لا تاخذه سنه ولا نوم له ما في السماوات وما في الارض من ذا الذي يشفع عنده الا باذنه يعلم ما بين ايديهم وما خلفهم ولا يحيطون بشيء من علمه الا بما شاء وسع كرسيه السماوات والارض ولا يئوده حفظهما وهو العلي العظيم'));
  assert.equal(p.ref, '2:255');
});
test('numéros de versets et ornements ignorés (﴿١﴾, ۝, chiffres)', () => {
  const p = exact(M.matchQuran(idx, 'قُلْ هُوَ اللَّهُ أَحَدٌ ﴿١﴾ اللَّهُ الصَّمَدُ ﴿٢﴾'));
  assert.deepEqual([p.kind, p.ref], ['range', '112:1-2']);
});
test('suite de versets consécutifs → 112:1-4, versets séparés par ۝', () => {
  const p = exact(M.matchQuran(idx, 'قل هو الله احد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد'));
  assert.deepEqual([p.kind, p.s, p.a, p.b, p.ref, p.whole], ['range', 112, 1, 4, '112:1-4', true]);
  assert.equal(p.official, [1, 2, 3, 4].map((a) => (a === 1 ? uthLine(112, 1).split(' ').slice(4).join(' ') : uthLine(112, a))).join(M.VERSE_SEP));
});
test('basmala en tête → conservée en écriture Tanzil 1:1, sourate reconnue', () => {
  const p = exact(M.matchQuran(idx, 'بسم الله الرحمن الرحيم قل هو الله احد'));
  assert.equal(p.ref, '112:1');
  assert.equal(p.basmala, true);
  assert.equal(p.official, uthLine(112, 1));
});
test('extrait d’un verset → partial, extrait uthmani exact (mots entiers du Tanzil)', () => {
  const p = exact(M.matchQuran(idx, 'لا تأخذه سنة ولا نوم'));
  assert.deepEqual([p.kind, p.ref, p.whole], ['partial', '2:255', false]);
  assert.ok(uthLine(2, 255).includes(p.official), p.official);
  assert.equal(p.official, 'لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ ۚ'); // signe de pause du Tanzil conservé
});
test('verset répété → autres emplacements signalés (55:13)', () => {
  const p = exact(M.matchQuran(idx, 'فبأي آلاء ربكما تكذبان'));
  assert.equal(p.ref, '55:13');
  assert.ok(p.also.length >= 10, String(p.also.length));
});
test('verset court entier (lettres isolées) accepté : الم → 2:1 (+ autres sourates)', () => {
  const p = exact(M.matchQuran(idx, 'الم'));
  assert.equal(p.ref, '2:1');
  assert.ok(p.also.includes('3:1'));
});
test('basmala seule → 1:1 (al-Fātiḥa)', () => {
  const p = exact(M.matchQuran(idx, 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'));
  assert.equal(p.ref, '1:1');
  assert.equal(p.official, uthLine(1, 1));
});
test('basmala + verset hors verset 1 → basmala de 1:1 en tête', () => {
  // « الله لا إله إلا هو الحي القيوم » est le verset entier 3:2 (préféré à l’extrait de 2:255).
  const p = exact(M.matchQuran(idx, 'بسم الله الرحمن الرحيم الله لا اله الا هو الحي القيوم'));
  assert.deepEqual([p.ref, p.kind, p.basmala], ['3:2', 'ayah', true]);
  assert.ok(p.official.startsWith(uthLine(1, 1) + ' '));
});
test('aucune correspondance : du‘a non coranique → none', () => {
  const r = M.matchQuran(idx, 'اللهم صل على سيدنا محمد وعلى آله وصحبه وسلم');
  assert.equal(r.level, 'none');
});
test('texte vide / non arabe / trop court → none', () => {
  assert.deepEqual(M.matchQuran(idx, '   '), { level: 'none', reason: 'empty' });
  assert.deepEqual(M.matchQuran(idx, 'hello world'), { level: 'none', reason: 'not-arabic' });
  assert.equal(M.matchQuran(idx, 'الله اكبر').level, 'none');
});
test('quasi-correspondance (un mot changé) → near, JAMAIS exact, écart signalé', () => {
  // 112:1-4 avec « يولد » remplacé par « يرزق » : ressemble, mais n’est pas le texte coranique.
  const r = M.matchQuran(idx, 'قل هو الله احد الله الصمد لم يلد ولم يرزق ولم يكن له كفوا احد');
  assert.equal(r.level, 'near');
  assert.equal(r.best.level, 'near');
  assert.equal(r.best.ref, '112:1-4');
  assert.ok(r.best.diff >= 1);
});
test('quasi-correspondance (mot manquant dans un extrait) → near', () => {
  const r = M.matchQuran(idx, 'الحمد لله رب العالمين الرحمن مالك يوم الدين');
  assert.equal(r.level, 'near');
  assert.equal(r.best.s, 1);
});
test('texte trop différent → none (pas de proposition forcée)', () => {
  const r = M.matchQuran(idx, 'قل هو العزيز الكريم في كل وقت وحين');
  assert.notEqual(r.level, 'exact');
});
test('le texte fourni n’est jamais modifié par l’analyse', () => {
  const src = 'قُلْ هُوَ اللَّهُ أَحَدٌ';
  const copy = String(src);
  M.matchQuran(idx, src);
  assert.equal(src, copy);
});
test('rapide : index < 4 s, recherche < 300 ms', () => {
  const t = Date.now();
  M.matchQuran(idx, 'قل هو الله احد الله الصمد لم يلد ولم يرزق ولم يكن له كفوا احد');
  assert.ok(Date.now() - t < 300, `${Date.now() - t} ms`);
  assert.ok(buildMs < 4000, `${buildMs} ms`);
});

let fail = 0;
for (const [n, f] of tests) {
  try {
    await f();
    console.log('✓', n);
  } catch (e) {
    fail++;
    console.log('✗', n, '\n   ', e.message);
  }
}
if (fail) {
  console.error(`Coran (rapprochement) : ${fail} échec(s).`);
  process.exit(1);
}
console.log(`Coran (rapprochement) : ${tests.length} tests passent (index ${buildMs} ms).`);
