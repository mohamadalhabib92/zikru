// Tests de l’import de programmes de zikr (src/lib/program-parse.ts, program-match.ts, pdf-lines.ts).
// Fixtures neutres : uniquement des formules déjà présentes dans le catalogue de l’app (aucun texte inventé).
// Exigences : étapes et nombres dans l’ordre, chiffres arabes-indiens/latins, ×/x/fois/مرة, nombres en lettres sûrs,
// numérotation jamais lue comme un nombre, et AUCUNE fausse correspondance silencieuse.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const L = await loadLib(['program-parse', 'program-match', 'pdf-lines', 'tijani', 'quran-match', 'quran-text', 'quran-uthmani'], 'programs');
const P = L['program-parse'];
const M = L['program-match'];
const PL = L['pdf-lines'];
const F = L.tijani.FORMULAS;
const idx = L['quran-match'].buildIndex(L['quran-text'].QURAN_TEXT, L['quran-uthmani'].QURAN_UTHMANI);
const simple = (s, a) => L['quran-text'].QURAN_TEXT.split('\n').find((l) => l.startsWith(`${s}|${a}|`)).split('|')[2];

const tests = [];
const test = (n, f) => tests.push([n, f]);
const steps = (txt) => P.parseProgram(Array.isArray(txt) ? txt : [txt]).steps;
const counts = (txt) => steps(txt).map((s) => s.count);
const match = (s) => M.matchStepText(s.ar, s.latin, idx);
const ids = (txt) => steps(txt).map((s) => { const m = match(s); return m.type === 'catalog' ? m.entry.id : m.type; });

const ISTI = F.istighfar.ar, FATIH = F.fatih.ar, HAIL = F.hailala.ar, CLOSE = F.closing.ar;

test('FR : liste numérotée « ×100 », « 100 fois », « x100 » → 3 étapes, ordre conservé, catalogue', () => {
  const t = `Programme\n1. ${ISTI} ×100\n2. ${FATIH} — 100 fois\n3. ${HAIL} x100`;
  const s = steps(t);
  assert.deepEqual(s.map((x) => [x.order, x.count, x.sure]), [[1, 100, true], [2, 100, true], [3, 100, true]]);
  assert.equal(s[0].ar, ISTI);
  assert.deepEqual(ids(t), ['tijani-istighfar', 'tijani-fatih', 'tijani-hailala']);
});
test('AR : chiffres arabes-indiens, « مرة », « مائة مرة », numérotation « ١- » ignorée', () => {
  const t = `١- ${ISTI} ١٠٠ مرة\n٢- ${FATIH} مائة مرة\n٣- ${HAIL} ۱۰۰ مرة\n٤- ${CLOSE} مرة واحدة`;
  assert.deepEqual(counts(t), [100, 100, 100, 1]);
  assert.deepEqual(ids(t), ['tijani-istighfar', 'tijani-fatih', 'tijani-hailala', 'tijani-closing']);
});
test('AR : nombres en lettres (avec ou sans tashkīl) suivis de مرة/مرات', () => {
  assert.deepEqual(counts(`${ISTI} ثلاث مرات\n\n${ISTI} مَرَّتَيْنِ\n\n${ISTI} سبع مرات\n\n${ISTI} ألف مرة\n\n${ISTI} ثلاثمائة مرة\n\n${ISTI} مِائَةَ مَرَّةٍ\n\n${ISTI} عشر مرات`), [3, 2, 7, 1000, 300, 100, 10]);
});
test('EN/FR en lettres : « one hundred times », « twice », « trois fois », « 100 times »', () => {
  assert.deepEqual(counts(`${ISTI} one hundred times\n\n${ISTI} twice\n\n${ISTI} trois fois\n\n${ISTI} 100 times\n\n${ISTI} 100x`), [100, 2, 3, 100, 100]);
});
test('un mot de nombre sans « مرة/fois/times » n’est pas lu comme un nombre', () => {
  const s = steps(`${ISTI} مائة`);
  assert.equal(s[0].count, null);
});
test('numérotation « 3. » / « 2) » jamais prise pour un nombre de répétitions', () => {
  const s = steps(`3. ${HAIL}\n\n2) ${ISTI}`);
  assert.deepEqual(s.map((x) => x.count), [null, null]);
  assert.equal(s[0].ar, HAIL);
});
test('« (100) » et nombre seul en fin de ligne : retenus mais à confirmer (sure = false)', () => {
  const s = steps(`${ISTI} (100)\n\n${HAIL} 100`);
  assert.deepEqual(s.map((x) => [x.count, x.sure]), [[100, false], [100, false]]);
});
test('deux nombres différents sur une étape : signalé (sure = false, alt)', () => {
  const s = steps(`${ISTI} ×100 — 70 fois`);
  assert.deepEqual([s[0].count, s[0].sure, s[0].alt], [100, false, [70]]);
});
test('formule sur deux lignes puis « ×100 » sur une ligne seule → une étape, reconnue', () => {
  const words = FATIH.split(' ');
  const half = Math.floor(words.length / 2);
  const t = `${words.slice(0, half).join(' ')}\n${words.slice(half).join(' ')}\n×100`;
  const s = steps(t);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].lines, [0, 1, 2]);
  assert.equal(s[0].count, 100);
  assert.deepEqual(ids(t), ['tijani-fatih']);
});
test('nombre sur la ligne suivante d’une formule (après ligne vide) complète l’étape', () => {
  const s = steps(`${HAIL}\n\n100 fois`);
  assert.equal(s.length, 1);
  assert.equal(s[0].count, 100);
});
test('titre latin puis formule arabe : le titre devient une indication', () => {
  const s = steps(`Salat al-Fatih\n${FATIH} ×100`);
  assert.equal(s.length, 1);
  assert.equal(s[0].hint, 'Salat al-Fatih');
});
test('lignes sans formule ni nombre : titre → indication, le reste dans « ignored », rien n’est perdu', () => {
  const r = P.parseProgram([`Wird\n${ISTI} ×100\nNote de bas de page`]);
  assert.equal(r.steps.length, 1);
  assert.equal(r.steps[0].hint, 'Wird');
  assert.deepEqual(r.ignored.map((x) => x.text), ['Note de bas de page']);
});
test('pages : chaque étape garde sa page', () => {
  const s = steps([`${ISTI} ×100`, `${HAIL} ×100`]);
  assert.deepEqual(s.map((x) => [x.page, x.order]), [[0, 1], [1, 2]]);
});
test('numéro de verset ornementé ﴿١﴾ non pris pour un nombre', () => {
  const s = steps(`${simple(112, 1)} ﴿١﴾`);
  assert.equal(s[0].count, null);
});
test('Latin : « Astaghfirullah », « Haylala », « Salat al-Fatih » → catalogue (orthographes voisines exactes après normalisation)', () => {
  assert.deepEqual(ids(`Salat al-Fatih ×100\n\nHaylala ×100`), ['tijani-fatih', 'tijani-hailala']);
  const m = match(steps('Astaghfirullah ×100')[0]);
  assert.ok(m.type === 'catalog' || m.type === 'ambiguous', m.type);
  if (m.type === 'ambiguous') assert.ok(m.options.some((o) => o.id === 'tijani-istighfar'));
  else assert.equal(m.entry.id, 'tijani-istighfar');
});
test('Latin ambigu : « Istighfar » (wird / wazifa) → ambigu, jamais choisi en silence', () => {
  const m = match(steps('Istighfar ×100')[0]);
  assert.equal(m.type, 'ambiguous');
  assert.ok(m.options.length >= 2);
});
test('Latin inconnu → non vérifié', () => {
  assert.equal(match(steps('Formule inconnue ×100')[0]).type, 'none');
});
test('Coran : verset exact (Tanzil) → quran, texte officiel', () => {
  const s = steps(`${simple(112, 1)} ×3`)[0];
  const m = match(s);
  assert.equal(m.type, 'quran');
  assert.equal(m.p.ref, '112:1');
  const it = M.stepToItem({ ...s, count: 3 }, m, true, 'pdf');
  assert.deepEqual([it.kind, it.reps, it.unverified], ['verse', 3, undefined]);
});
test('PAS de fausse correspondance : formule tronquée d’un mot → non vérifié', () => {
  const cut = FATIH.split(' ').slice(0, -1).join(' ');
  const m = M.matchStepText(cut, '', idx);
  assert.equal(m.type, 'none');
  const it = M.stepToItem({ ar: cut, latin: '', hint: '', count: 100 }, m, true, 'paste');
  assert.deepEqual([it.kind, it.unverified, it.ar], ['free', true, cut]);
});
test('PAS de fausse correspondance : un mot changé dans un verset → « near » (signalé, jamais « quran »)', () => {
  const w = simple(1, 2).split(' ');
  w[w.length - 1] = 'النَّاسِ';
  const v = w.join(' ');
  const m = M.matchStepText(v, '', idx);
  assert.equal(m.type, 'near');
  const it = M.stepToItem({ ar: v, latin: '', hint: '', count: 1 }, m, true, 'paste');
  assert.equal(it.unverified, true);
});
test('PAS de fausse correspondance : lettres sans sens → non vérifié', () => {
  assert.equal(M.matchStepText('بببب تتتت', '', idx).type, 'none');
});
test('formes de présentation (PDF) : ﻻ / ﷲ ramenés aux lettres de base pour la comparaison', () => {
  const pf = HAIL.normalize('NFC').replace(/[\u064B-\u0652]/g, '').replace('لا', '\uFEFB').replace('الله', '\uFDF2');
  assert.equal(M.matchStepText(pf, '', idx).type, 'catalog');
});
test('catalogue : une entrée par texte, Noms « يا لطيف » et « اللطيف »', () => {
  const cat = M.buildCatalog();
  assert.equal(new Set(cat.map((e) => e.key)).size, cat.length);
  const a = M.matchStepText('يَا لَطِيفُ', '', idx);
  assert.equal(a.type, 'catalog');
  assert.equal(a.entry.kind, 'name');
});
test('catalogue : texte officiel remplacé seulement si l’utilisateur le choisit', () => {
  const s = steps(`${ISTI.replace(/[\u064B-\u0652]/g, '')} ×100`)[0];
  const m = match(s);
  assert.equal(m.type, 'catalog');
  assert.equal(M.stepToItem({ ...s, count: 100 }, m, true, 'paste').ar, ISTI);
  const own = M.stepToItem({ ...s, count: 100 }, m, false, 'paste');
  assert.deepEqual([own.ar, own.unverified], [s.ar, true]);
});
test('PDF : regroupement des morceaux de texte en lignes (RTL : x décroissant ; LTR : x croissant)', () => {
  const it = (str, x, y, w = 10, h = 10) => ({ str, x, y, w, h });
  const lines = PL.itemsToLines([it('×100', 10, 700, 30), it('اللَّهَ', 60, 700, 30), it('أَسْتَغْفِرُ', 100, 701, 40), it('Wird', 10, 760, 30), it('du', 45, 760, 15)]);
  assert.deepEqual(lines, ['Wird du', 'أَسْتَغْفِرُ اللَّهَ ×100']);
  assert.deepEqual(counts(lines.join('\n')), [100]);
});

test('PDF : nettoyage minimal (contrôles, voyelles retournées, latin parasite, chiffres collés), lettres inchangées', () => {
  assert.equal(PL.markFirst('َه'), 'هَ');
  assert.equal(PL.markFirst('هَو'), 'هَو'); // ordre correct : intact
  assert.equal(PL.cleanLine('الله\u0007\uFFFD ×3'), 'الله ×3');
  assert.equal(PL.cleanLine('اللَّهِk ١٠٠ مرة'), 'اللَّهِ ١٠٠ مرة');
  assert.equal(PL.cleanLine('اللَّهَ١٠٠ مرة'), 'اللَّهَ ١٠٠ مرة');
  assert.equal(PL.cleanLine('الله x3'), 'الله x3'); // séparé par une espace : gardé
  assert.equal(PL.cleanLine('Salat al-Fatih 10 fois'), 'Salat al-Fatih 10 fois');
  assert.deepEqual(counts('أستغفر الله مرةواحدة'), [1]);
});

test('PDF : glyphes sans correspondance (U+0000) → page illisible, jamais devinée', () => {
  assert.equal(PL.brokenGlyphs([{ str: 'ا\u0000\u0000ل\u0000\u0000ه' }]), true);
  assert.equal(PL.brokenGlyphs([{ str: ISTI + ' ١٠٠ مرة' }]), false);
  assert.equal(PL.brokenGlyphs([{ str: 'Hello\u0000' }]), false);
});

test('repli sans espaces : catalogue et verset entier reconnus, signalés « loose »', () => {
  const cut = ISTI.replace(/ /g, '');
  const m = M.matchStepText(cut, '', idx);
  assert.equal(m.type, 'catalog');
  assert.equal(m.entry.id, 'tijani-istighfar');
  assert.equal(m.loose, true);
  const q = M.matchStepText('قُلْ هُوَ اللَّهُ أَ حَدٌ', '', idx);
  assert.equal(q.type, 'quran');
  assert.equal(q.p.ref, '112:1');
  assert.equal(q.loose, true);
  const exact = M.matchStepText(ISTI, '', idx);
  assert.ok(!exact.loose);
});

test('repli sans espaces : aucune fausse correspondance (lettre changée, texte court, fragment)', () => {
  assert.equal(M.matchStepText(ISTI.replace(/ /g, '').replace('غ', 'ع'), '', idx).type === 'catalog', false);
  assert.equal(M.matchStepText('اللهالله', '', idx).type === 'catalog', false);
  const r = M.matchStepText('قلهوالله', '', idx); // début de 112:1 seulement
  assert.ok(!(r.type === 'quran' && r.loose), r.type);
  // lettres inversées (extraction PDF défectueuse) : non vérifié, pas de supposition
  const key = M.buildCatalog().find((e) => e.id === 'tijani-fatih').key;
  assert.ok(key.includes('الخاتم'));
  const swapped = key.replace('الخاتم', 'الاختم').replace(/ /g, '');
  assert.notEqual(M.matchStepText(swapped, '', idx).type, 'catalog');
});

let fail = 0;
for (const [n, f] of tests) {
  try {
    f();
    console.log('  ✓', n);
  } catch (e) {
    fail++;
    console.log('  ✗', n, '\n    ', e.message);
  }
}
console.log(fail ? `programmes : ${fail} échec(s)` : `programmes : ${tests.length} tests OK`);
if (fail) process.exit(1);
