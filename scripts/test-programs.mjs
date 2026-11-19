// Tests de l’import de programmes de zikr (src/lib/program-parse.ts, program-match.ts, pdf-lines.ts).
// Fixtures neutres : uniquement des formules déjà présentes dans le catalogue de l’app (aucun texte inventé).
// Exigences : étapes et nombres dans l’ordre, chiffres arabes-indiens/latins, ×/x/fois/مرة, nombres en lettres sûrs,
// numérotation jamais lue comme un nombre, et AUCUNE fausse correspondance silencieuse.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const L = await loadLib(['program-parse', 'program-lang', 'ocr-merge', 'program-group', 'program-match', 'pdf-lines', 'tijani', 'quran-match', 'quran-text', 'quran-uthmani'], 'programs');
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

test('x33, 33 fois, ٣٣ مرة : trois étapes, chaque nombre reste le sien', () => {
  const t = `${ISTI} x33\n${FATIH} 33 fois\n${HAIL} ٣٣ مرة`;
  const s = steps(t);
  assert.deepEqual(s.map((x) => [x.order, x.count, x.sure]), [[1, 33, true], [2, 33, true], [3, 33, true]]);
  assert.ok(s.every((x) => x.count !== 99), 'les trois 33 ne sont pas additionnés');
});
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

test('repli sans espaces : proposé mais jamais accepté d’office (confirmation de l’utilisateur requise)', () => {
  const cut = ISTI.replace(/ /g, '');
  const m = M.matchStepText(cut, '', idx);
  assert.equal(m.type, 'loose');
  assert.equal(m.target.type, 'catalog');
  assert.equal(m.target.entry.id, 'tijani-istighfar');
  // non confirmé : enregistré comme texte personnel non vérifié, même si « texte officiel » est demandé
  const before = M.stepToItem({ ar: cut, latin: '', hint: '', count: 100 }, M.confirmLoose(m, false), true, 'pdf');
  assert.equal(before.unverified, true);
  assert.equal(before.ar, cut);
  // confirmé : texte officiel du catalogue
  const after = M.stepToItem({ ar: cut, latin: '', hint: '', count: 100 }, M.confirmLoose(m, true), true, 'pdf');
  assert.equal(after.ar, F.istighfar.ar);
  assert.ok(!after.unverified);
  const q = M.matchStepText('قُلْ هُوَ اللَّهُ أَ حَدٌ', '', idx);
  assert.equal(q.type, 'loose');
  assert.equal(q.target.type, 'quran');
  assert.equal(q.target.p.ref, '112:1');
  assert.equal(M.stepToItem({ ar: 'قُلْ هُوَ اللَّهُ أَ حَدٌ', latin: '', hint: '', count: 3 }, M.confirmLoose(q, false), true, 'pdf').unverified, true);
  assert.equal(M.confirmLoose(q, true).type, 'quran');
  // texte exact : reconnu directement, sans confirmation
  assert.equal(M.matchStepText(ISTI, '', idx).type, 'catalog');
  assert.equal(M.confirmLoose(M.matchStepText(ISTI, '', idx), false).type, 'catalog');
});

test('repli sans espaces : aucune fausse correspondance (lettre changée, texte court, fragment)', () => {
  assert.ok(!['catalog', 'loose'].includes(M.matchStepText(ISTI.replace(/ /g, '').replace('غ', 'ع'), '', idx).type));
  assert.ok(!['catalog', 'loose'].includes(M.matchStepText('اللهالله', '', idx).type));
  const r = M.matchStepText('قلهوالله', '', idx); // début de 112:1 seulement
  assert.ok(r.type !== 'loose' && r.type !== 'quran', r.type);
  // lettres inversées (extraction PDF défectueuse) : non vérifié, pas de supposition
  const key = M.buildCatalog().find((e) => e.id === 'tijani-fatih').key;
  assert.ok(key.includes('الخاتم'));
  const swapped = key.replace('الخاتم', 'الاختم').replace(/ /g, '');
  assert.ok(!['catalog', 'loose'].includes(M.matchStepText(swapped, '', idx).type));
});

// ——— Multilingue (photos de programmes dans toutes les langues). Fixtures : formules du catalogue, « سبحان الله »,
// ou chaînes de test manifestement factices (« Formule test »). Aucun contenu religieux inventé.
const SUB = 'سبحان الله';
const LG = L['program-lang'];
const OM = L['ocr-merge'];
test('multilingue : fois / times / mal / volte / veces / vezes / defa / kere / kez / kali', () => {
  const words = ['33 fois', '33 times', '33 mal', '33-mal', '33 volte', '33 veces', '33 vezes', '33 defa', '33 kere', '33 kez', '33 kali'];
  for (const w of words) {
    const s = steps(`${SUB} ${w}`);
    assert.deepEqual([s.length, s[0].count, s[0].sure, s[0].ar], [1, 33, true, SUB], w);
  }
});
test('multilingue : ourdou « ۳۳ بار » (chiffres persans) et « ۱۰۰ دفعہ »', () => {
  assert.deepEqual(counts(`${SUB} ۳۳ بار\n\n${ISTI} ۱۰۰ دفعہ`), [33, 100]);
  assert.ok(steps(`${SUB} ۳۳ بار`)[0].sure);
});
test('multilingue : wolof « 33 yoon » retenu mais à vérifier (motif moins fiable)', () => {
  const s = steps(`${SUB} 33 yoon`);
  assert.deepEqual([s[0].count, s[0].sure], [33, false]);
});
test('arabe en lettres : ثلاث وثلاثون مرة (33), ثلاثاً وثلاثين مرة, إحدى وعشرين مرة, سبعين مرة, ثلاثة مرات', () => {
  assert.deepEqual(counts(`${SUB} ثلاث وثلاثون مرة\n\n${SUB} ثلاثاً وثلاثين مرة\n\n${SUB} إحدى وعشرين مرة\n\n${SUB} سبعين مرة\n\n${SUB} ثلاثة مرات\n\n${SUB} أربعاً وثلاثين مرة`), [33, 33, 21, 70, 3, 34]);
});
test('français / anglais composés : « trente-trois fois », « vingt et une fois », « thirty-three times »', () => {
  assert.deepEqual(counts(`${SUB} trente-trois fois\n\n${SUB} vingt et une fois\n\n${SUB} thirty-three times\n\n${SUB} soixante-dix fois\n\n${SUB} quatre-vingt-dix-neuf fois\n\n${SUB} soixante fois`), [33, 21, 33, 70, 99, 60]);
});
test('page mixte : formule arabe, translittération, nombre sur la ligne suivante → une étape, note gardée telle quelle', () => {
  const s = steps(`${SUB}\nSubhanallah (Formule test)\n33 fois`);
  assert.equal(s.length, 1);
  assert.deepEqual([s[0].ar, s[0].count, s[0].sure, s[0].lines], [SUB, 33, true, [0, 1, 2]]);
  assert.equal(s[0].note, 'Subhanallah (Formule test)');
});
test('page mixte : formule arabe puis « Subhanallah 33 times » → une étape, nombre à vérifier', () => {
  const s = steps(`${SUB}\nSubhanallah 33 times`);
  assert.deepEqual([s.length, s[0].ar, s[0].count, s[0].sure, s[0].note], [1, SUB, 33, false, 'Subhanallah']);
});
test('page mixte : note latine puis nouvelle formule arabe → deux étapes, rien de fusionné', () => {
  const s = steps(`${SUB}\nFormule test\n${ISTI} ×100`);
  assert.deepEqual(s.map((x) => [x.ar, x.count]), [[SUB, null], [ISTI, 100]]);
  assert.equal(s[0].note, 'Formule test');
});
test('étiquettes d’ordre « Étape 2 : », « Step 3 – », « Schritt 1 », « الخطوة ٢ : » jamais lues comme un nombre', () => {
  const s = steps(`Étape 1 : ${SUB} 33 fois\n\nStep 2 – ${ISTI} 100 times\n\nSchritt 3 ${HAIL} 100 mal\n\nالخطوة ٤ : ${SUB} ٣٣ مرة\n\nAdım 5 ${SUB} 33 defa`);
  assert.deepEqual(s.map((x) => [x.count, x.sure]), [[33, true], [100, true], [100, true], [33, true], [33, true]]);
  assert.equal(s[0].ar, SUB);
});
test('étape latine seule dans d’autres langues : « Formule test 33 veces » / « Formule test 33 kali »', () => {
  const s = steps('Formule test 33 veces\n\nFormule test 33 kali');
  assert.deepEqual(s.map((x) => [x.latin, x.count, x.sure]), [['Formule test', 33, true], ['Formule test', 33, true]]);
});
test('pas de faux nombre : « mal », « vez », « kali » sans nombre, ou collés à un mot, ne comptent pas', () => {
  assert.deepEqual(counts(`${SUB} mal\n\n${SUB} kali\n\n${SUB} A33mal`), [null, null, null]);
});
test('langues détectées : arabe + français, arabe + anglais, ourdou, turc, indonésien, latin non identifié', () => {
  assert.deepEqual(LG.detectLanguages(`${SUB} 33 fois, puis ${ISTI} 100 fois`), ['ar', 'fr']);
  assert.deepEqual(LG.detectLanguages(`${SUB} 33 times, then the next one`), ['ar', 'en']);
  assert.deepEqual(LG.detectLanguages(`${SUB} ۳۳ بار پڑھیں اور ہر روز`), ['ur']);
  assert.deepEqual(LG.detectLanguages('Formule test 33 defa, sonra 33 kere'), ['tr']);
  assert.deepEqual(LG.detectLanguages('Formule test 33 kali, lalu 33 kali'), ['id']);
  assert.deepEqual(LG.detectLanguages('Subhanallah'), ['latin']);
  assert.deepEqual(LG.detectLanguages(SUB), ['ar']);
});
test('Vision : plan de langues (arabe d’abord, latin ensuite, CJK à part, codes absents ignorés)', () => {
  const p = OM.planLanguages(['en-US', 'fr-FR', 'zh-Hans', 'ar-SA', 'ars-SA', 'de-DE', 'tr-TR', 'ko-KR', 'ru-RU', 'id-ID']);
  assert.deepEqual(p.arabic, ['ar-SA', 'ars-SA']);
  assert.deepEqual(p.others, ['fr-FR', 'en-US', 'de-DE', 'tr-TR', 'id-ID', 'ru-RU']);
  assert.deepEqual(OM.planLanguages(['en-US', 'fr-FR']).arabic, []);
});
test('Vision : fusion des passes (arabe gardé de la passe arabe, latin de la meilleure confiance, lignes uniques gardées)', () => {
  const A = [
    { text: SUB, confidence: 0.9, box: [0.5, 0.8, 0.4, 0.05] },
    { text: 'Sobhanallah', confidence: 0.4, box: [0.1, 0.7, 0.5, 0.05] },
  ];
  const B = [
    { text: 'Ssbhn llh', confidence: 0.95, box: [0.5, 0.8, 0.4, 0.05] }, // lecture latine de l’arabe : écartée
    { text: 'Subhanallah', confidence: 0.8, box: [0.1, 0.7, 0.5, 0.05] },
    { text: '33 fois', confidence: 0.9, box: [0.1, 0.6, 0.2, 0.05] },
  ];
  assert.deepEqual(OM.mergePasses(A, B).map((l) => l.text), [SUB, 'Subhanallah', '33 fois']);
  // sans positions (ancien build) : passe arabe gardée si elle contient de l’arabe
  assert.deepEqual(OM.mergePasses([{ text: SUB, confidence: 0.5 }], [{ text: 'x', confidence: 0.9 }]).map((l) => l.text), [SUB]);
  assert.deepEqual(OM.mergePasses([], B).length, 3);
});
test('Vision : le texte fusionné n’est jamais modifié (chaque ligne vient telle quelle d’une passe)', () => {
  const A = [{ text: '  ' + ISTI + ' ×100 ', confidence: 0.7, box: [0.2, 0.5, 0.6, 0.05] }];
  const out = OM.mergePasses(A, [{ text: 'Formule test', confidence: 0.99, box: [0.2, 0.3, 0.6, 0.05] }]);
  assert.deepEqual(out.map((l) => l.text), [A[0].text, 'Formule test']);
});

// ——— Programme importé → objectifs communs d’un groupe (sans migration)
const PG = L['program-group'];
test('import : zikr personnel par défaut, partage seulement si on le demande', () => {
  const dest = { scope: 'family', id: 'f1', name: 'Maison', role: 'parent' };
  assert.deepEqual(PG.importCommit(false, dest), { private: true, share: null });
  assert.deepEqual(PG.importCommit(true, null), { private: true, share: null });
  assert.equal(PG.importCommit(true, dest).share, dest);
  const goals = PG.stepsToGoals([
    { label: 'a', ar: ISTI, reps: 33 },
    { label: 'b', ar: FATIH, reps: 33 },
    { label: 'c', ar: HAIL, reps: 33 },
  ]);
  assert.deepEqual(goals.map((g) => g.target), [33, 33, 33]);
  assert.equal(new Set(goals.map((g) => g.step)).size, 3);
});
const cp = (x) => [...x].length;
test('groupe : une étape = un objectif, titre « N. libellé », formule = texte validé, cible = nombre', () => {
  const d = PG.stepsToGoals([
    { label: 'Istighfār', ar: ISTI, reps: 100, ref: 'Catalogue Zikru' },
    { label: 'Formule test', ar: 'Formule test', reps: 33, unverified: true },
  ]);
  assert.deepEqual(d.map((x) => [x.step, x.title, x.formula, x.target, x.unverified]), [
    [1, '1. Istighfār', ISTI, 100, false],
    [2, '2. Formule test', 'Formule test', 33, true],
  ]);
  assert.ok(d.every((x) => !x.titleCut && !x.formulaCut));
});
test('groupe : formule > 200 / titre > 80 coupés avec « … » et signalés ; texte qui tient jamais modifié', () => {
  const long = Array.from({ length: 40 }, () => SUB).join(' ');
  const [d] = PG.stepsToGoals([{ label: long, ar: long, reps: 7 }]);
  assert.ok(d.formulaCut && d.titleCut);
  assert.ok(cp(d.formula) <= 200 && cp(d.title) <= 80, `${cp(d.formula)} ${cp(d.title)}`);
  assert.ok(d.formula.endsWith(' …'));
  assert.ok(long.startsWith(d.formula.slice(0, -2)), 'début identique au texte validé');
  const exact = 'x'.repeat(200);
  assert.deepEqual(PG.clip(exact, 200), { text: exact, cut: false });
  assert.equal(PG.stepsToGoals([{ label: 'a', ar: exact, reps: 1 }])[0].formula, exact);
});
test('groupe : nombre borné aux limites du serveur ; libellé vide → texte arabe', () => {
  const [a, b2] = PG.stepsToGoals([{ label: '', ar: SUB, reps: 0 }, { label: 'x', ar: '', reps: 5e6 }]);
  assert.deepEqual([a.title, a.target, b2.formula, b2.target], [`1. ${SUB}`, 1, null, 100000]);
});
test('groupe : ordre d’envoi inverse (la liste du groupe affiche le plus récent en haut → étape 1 en haut)', () => {
  assert.deepEqual(PG.insertionOrder(4), [3, 2, 1, 0]);
  assert.deepEqual(PG.insertionOrder(0), []);
});
test('groupe : idempotence — même lot = mêmes identifiants (double appui, hors ligne) ; autre contenu ou groupe = nouveaux', () => {
  const d = PG.stepsToGoals([{ label: 'Formule test', ar: SUB, reps: 33 }]);
  const dest = { scope: 'family', id: 'f1' };
  const sig = PG.batchSignature(dest, d);
  let n = 0;
  const mk = () => `id${++n}`;
  const ids = PG.planIds(null, sig, 1, mk);
  assert.deepEqual(PG.planIds({ sig, ids }, sig, 1, mk), ids);
  assert.equal(PG.batchSignature(dest, d), sig);
  assert.notEqual(PG.batchSignature({ scope: 'circle', id: 'f1' }, d), sig);
  assert.notEqual(PG.batchSignature(dest, PG.stepsToGoals([{ label: 'Formule test', ar: SUB, reps: 34 }])), sig);
  assert.notDeepEqual(PG.planIds({ sig: 'autre', ids }, sig, 1, mk), ids);
});
test('groupe : destinations = administrateur seulement (famille parent, cercle fondateur, jamais un enfant)', () => {
  const fams = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }];
  const cirs = [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }, { id: 'z', name: 'Z' }];
  const roles = { family: { a: 'parent', b: 'adult', c: 'child', d: 'guest' }, circle: { x: 'founder', y: 'moderator', z: 'member' } };
  assert.deepEqual(PG.allowedDestinations(fams, cirs, roles, false).map((d) => d.scope + ':' + d.id), ['family:a', 'circle:x']);
  assert.deepEqual(PG.allowedDestinations(fams, cirs, roles, true), []);
  const ds = PG.allowedDestinations(fams, cirs, roles, false);
  assert.deepEqual(ds.map(PG.canSetWird), [true, false]);
});
test('groupe : résumé du wird (≤ 500, sinon rien)', () => {
  const items = [{ label: 'Istighfār', ar: ISTI, reps: 100 }, { label: 'Formule test', ar: SUB, reps: 33 }];
  assert.equal(PG.wirdSummary('Programme test', items), 'Programme test : 1. Istighfār × 100 · 2. Formule test × 33');
  assert.equal(PG.wirdSummary('x', Array.from({ length: 40 }, () => ({ label: 'Formule test numéro', ar: '', reps: 100 }))), null);
  assert.equal(PG.wirdSummary('x', []), null);
});

// ——— Programme de groupe (tables group_programs, migration 20261102152251)
test('programme de groupe : texte arabe complet (jamais coupé à 200), statut quran/catalogue/unverified, ordre', () => {
  const long = Array.from({ length: 40 }, () => SUB).join(' ');
  const p = PG.stepsToProgram('  Programme test ', [
    { label: 'Istighfār', ar: ISTI, tr: 'astaghfiru llah', reps: 100, ref: 'Catalogue Zikru', kind: 'formula' },
    { label: 'Coran test', ar: long, reps: 1, ref: 'Coran 1:1', kind: 'verse' },
    { label: 'Formule test', ar: 'Formule test', reps: 33, unverified: true, kind: 'free' },
  ]);
  assert.equal(p.title, 'Programme test');
  assert.deepEqual(p.steps.map((s) => [s.label, s.verification, s.target]), [['Istighfār', 'catalogue', 100], ['Coran test', 'quran', 1], ['Formule test', 'unverified', 33]]);
  assert.equal(p.steps[0].arabic, ISTI);
  assert.equal(p.steps[0].translit, 'astaghfiru llah');
  assert.equal(p.steps[1].arabic, long, 'texte complet, identique');
  assert.ok(p.steps.every((s) => !s.cut));
});
test('programme de groupe : limites (100 étapes, 4000 caractères, nombre 1..100000), signature stable', () => {
  const huge = 'x'.repeat(4100);
  const p = PG.stepsToProgram('t', Array.from({ length: 120 }, () => ({ label: 'a', ar: huge, reps: 0 })));
  assert.equal(p.steps.length, 100);
  assert.ok(p.steps[0].cut && cp(p.steps[0].arabic) <= 4000 && p.steps[0].target === 1);
  const one = PG.stepsToProgram('t', [{ label: 'a', ar: SUB, reps: 3 }]);
  const dest = { scope: 'family', id: 'f1' };
  assert.equal(PG.programSignature(dest, one.title, one.steps), PG.programSignature(dest, one.title, one.steps));
  assert.notEqual(PG.programSignature(dest, 'autre', one.steps), PG.programSignature(dest, one.title, one.steps));
  assert.notEqual(PG.programSignature({ scope: 'circle', id: 'f1' }, one.title, one.steps), PG.programSignature(dest, one.title, one.steps));
});
test('tasbih de groupe : enchaînement automatique, bornes, annulation, fin', () => {
  const st = [{ id: 'a', target: 2 }, { id: 'b', target: 1 }];
  let c = {};
  assert.equal(PG.currentStep(st, c), 0);
  let r = PG.tapStep(st, c, 0);
  assert.deepEqual([r.counts.a, r.next, r.completed], [1, 0, false]);
  r = PG.tapStep(st, r.counts, 0);
  assert.deepEqual([r.counts.a, r.next, r.completed], [2, 1, true]);
  r = PG.tapStep(st, r.counts, 0);
  assert.deepEqual([r.counts.a, r.completed], [2, false], 'jamais au-delà du nombre');
  r = PG.tapStep(st, r.counts, 1);
  assert.deepEqual([r.counts.b, r.next, r.completed], [1, 1, true]);
  assert.ok(PG.programDone(st, r.counts));
  assert.equal(PG.currentStep(st, r.counts), 1);
  r = PG.tapStep(st, r.counts, 1, -1);
  assert.equal(r.counts.b, 0);
  assert.equal(PG.tapStep(st, { a: 0 }, 0, -1).counts.a, 0, 'jamais sous 0');
  assert.ok(!PG.programDone([], {}));
  assert.deepEqual(PG.mergeCounts({ a: 1, b: 1 }, { a: 2, b: 0 }, ['a']), { a: 2, b: 1 });
});

test('redécoupe : les lignes source restent les bonnes, même sur un indice impair', () => {
  const src = ['سبحان الله ×33', 'الحمد لله 33 fois', 'الله أكبر ×34'];
  assert.deepEqual(P.sourceLinesForResplit(src, [0]), [src[0]]);
  assert.deepEqual(P.sourceLinesForResplit(src, [1]), [src[0]], 'la ligne vide intercalée ne donne pas un indice fractionnaire');
  assert.deepEqual(P.sourceLinesForResplit(src, [4, 5]), [src[2]]);
  assert.deepEqual(P.sourceLinesForResplit(src, [99]), []);
});
test('import : un collage énorme est refusé, et le parseur s’arrête à 200 étapes', () => {
  assert.equal(P.importTooLarge('a'.repeat(P.MAX_IMPORT_CHARS + 1)), true);
  assert.equal(P.importTooLarge('a'.repeat(P.MAX_IMPORT_CHARS)), false);
  const huge = Array.from({ length: 250 }, (_, i) => `سبحان الله ×${i + 1}`).join('\n');
  const r = P.parseProgram([huge]);
  assert.equal(r.steps.length, P.MAX_IMPORT_STEPS);
  assert.equal(r.truncated, true);
  assert.equal(r.steps[0].count, 1);
  assert.equal(r.steps[199].count, 200);
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
