// Tests du module bien-être : cycles de respiration et minuteurs, méditation, jeux (ordre, mot manquant, suite),
// intégration SM-2, rendu tajwid (extrait 112 de l’édition « quran-tajweed »), leçons (exemples lus dans Tanzil),
// contraste des couleurs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLib } from './load-lib.mjs';

const { breath: B, meditation: M, 'learn-games': G, tajwid: T, srs, 'quran-uthmani': U, 'quran-nav': N, quran: Q } = await loadLib(
  ['breath', 'meditation', 'learn-games', 'tajwid', 'srs', 'quran-uthmani', 'quran-nav', 'quran'],
  'bien-etre',
);
let ok = 0;
const test = async (n, f) => {
  await f();
  ok++;
  console.log('✓', n);
};
// Texte Tanzil (même découpage que loadUthmani : basmala d’ouverture retirée hors Fatiha).
const V = new Map();
for (const line of U.QURAN_UTHMANI.split('\n')) {
  if (!line || line[0] === '#') continue;
  const [s, a, ...r] = line.split('|');
  const t = r.join('|');
  V.set(`${+s}:${+a}`, +s !== 1 && +a === 1 ? Q.stripBasmala(t) : t);
}
const verse = (s, a) => V.get(`${s}:${a}`);
const surah = (s) => Array.from({ length: N.OFFSETS[s] - N.OFFSETS[s - 1] }, (_, i) => verse(s, i + 1));

// ——— Respiration ———
await test('cohérence cardiaque : 6 respirations par minute, 5 min = 30 cycles exacts', () => {
  const p = B.PATTERNS.coherence;
  assert.equal(B.breathsPerMinute(p), 6);
  assert.equal(B.DEFAULT_MINUTES, 5);
  assert.equal(B.sessionMs(p, 5), 300000);
  assert.equal(B.sessionMs(p, 5) / B.cycleMs(p), 30);
});
await test('respiration carrée 4-4-4-4 : phases dans l’ordre, séance arrondie au cycle complet', () => {
  const p = B.PATTERNS.box;
  assert.deepEqual(p.phases.map((x) => [x.p, x.s]), [['in', 4], ['holdIn', 4], ['out', 4], ['holdOut', 4]]);
  assert.equal(B.cycleMs(p), 16000);
  assert.equal(B.sessionMs(p, 5), 19 * 16000); // 304 s : on finit la dernière rétention
  assert.equal(B.breathAt(p, 0).phase, 'in');
  assert.equal(B.breathAt(p, 3999).phase, 'in');
  assert.equal(B.breathAt(p, 4000).phase, 'holdIn');
  assert.equal(B.breathAt(p, 8000).phase, 'out');
  assert.equal(B.breathAt(p, 12000).phase, 'holdOut');
  assert.equal(B.breathAt(p, 16000).phase, 'in');
  assert.equal(B.breathAt(p, 16000).cycle, 1);
});
await test('remplissage du cercle continu et borné ; décompte 5…1', () => {
  const p = B.PATTERNS.coherence;
  let prev = B.breathAt(p, 0).level;
  assert.equal(prev, 0);
  for (let t = 50; t < 20000; t += 50) {
    const l = B.breathAt(p, t).level;
    assert.ok(l >= 0 && l <= 1);
    assert.ok(Math.abs(l - prev) < 0.05, 'pas de saut à ' + t);
    prev = l;
  }
  assert.equal(B.breathAt(p, 5000).level, 1);
  assert.equal(B.breathAt(p, 0).secondsLeft, 5);
  assert.equal(B.breathAt(p, 4001).secondsLeft, 1);
});
await test('fin de séance : done, temps restant nul', () => {
  const p = B.PATTERNS.coherence, tot = B.sessionMs(p, 1);
  assert.equal(B.breathAt(p, tot - 1, tot).done, false);
  const e = B.breathAt(p, tot, tot);
  assert.equal(e.done, true);
  assert.equal(e.remainingMs, 0);
  assert.equal(e.phase, 'out');
});
await test('changements de phase (haptique) : un par passage, rien après la fin', () => {
  const p = B.PATTERNS.box;
  assert.deepEqual(B.phaseChanges(p, 0, 16000), ['holdIn', 'out', 'holdOut', 'in']);
  assert.deepEqual(B.phaseChanges(p, 3900, 4100), ['holdIn']);
  assert.deepEqual(B.phaseChanges(p, 4100, 4200), []);
  assert.deepEqual(B.phaseChanges(p, 15000, 17000, 16000), []);
  // somme sur des pas de 16 ms = même liste qu’en un seul pas
  const all = [];
  for (let t = 0; t < 32000; t += 16) all.push(...B.phaseChanges(p, t, t + 16));
  assert.deepEqual(all, B.phaseChanges(p, 0, 32000));
});
await test('dhikr au souffle : inspiration / expiration seulement, rétentions silencieuses', () => {
  const pr = { in: 'name-1', out: 'name-2' };
  assert.equal(B.pairedFor(pr, 'in'), 'name-1');
  assert.equal(B.pairedFor(pr, 'out'), 'name-2');
  assert.equal(B.pairedFor(pr, 'holdIn'), undefined);
  assert.equal(B.pairedFor(null, 'in'), undefined);
});
await test('paliers privés : 5 min par défaut, palier suivant proposé après 3 séances', () => {
  let log = B.EMPTY_LOG;
  assert.equal(B.suggestedMinutes(log), 5);
  log = B.logSession(log, 1);
  assert.equal(B.suggestedMinutes(log), 1);
  log = B.logSession(B.logSession(log, 1), 1);
  assert.equal(B.suggestedMinutes(log), 3);
  assert.equal(log.sessions, 3);
  assert.equal(log.minutes, 3);
});

// ——— Méditation ———
await test('méditation : durées 3 à 10 min, versets existants du texte Tanzil', () => {
  assert.equal(M.clampMinutes(1), 3);
  assert.equal(M.clampMinutes(30), 10);
  for (const th of M.THEMES) for (const [s, a] of M.themeRefs(th)) assert.ok(verse(s, a), `${s}:${a}`);
  assert.equal(M.THEMES.filter((x) => x.kind === 'tafakkur').map((x) => x.id).join(), 'creation,sky,sea');
});
await test('minuteur doux : consignes dans l’ordre, dernière dans la dernière minute, fin exacte', () => {
  for (const kind of ['tafakkur', 'muraqaba']) {
    let prev = 0;
    for (let t = 0; t <= 300000; t += 1000) {
      const st = M.meditationAt(kind, 2, 5, t);
      assert.ok(st.step >= prev);
      prev = st.step;
    }
    assert.equal(M.meditationAt(kind, 2, 5, 0).step, 0);
    assert.equal(M.meditationAt(kind, 2, 5, 240001).step, M.STEPS[kind].length - 1);
    assert.equal(M.meditationAt(kind, 2, 5, 239000).step, M.STEPS[kind].length - 2);
    assert.equal(M.meditationAt(kind, 2, 5, 300000).done, true);
    assert.equal(M.meditationAt(kind, 2, 5, 150000).verse, 1);
    assert.equal(M.stepTimes(kind, 5).length, M.STEPS[kind].length - 1);
  }
});

// ——— Jeux ———
await test('mots d’un verset : recollés à l’identique ; signes de pause et ۞ rattachés', () => {
  let n = 0;
  for (const v of V.values()) {
    assert.equal(G.words(v).join(' '), v);
    for (const w of G.words(v)) assert.ok(G.letterKey(w).length > 0, 'mot sans lettre : ' + w);
    n++;
  }
  assert.equal(n, 6236);
  assert.ok(G.words(verse(2, 5))[4].endsWith(' ۖ'));
  assert.equal(G.letterKey(G.words(verse(2, 5))[4]), 'ربهم');
  assert.ok(G.words(verse(25, 53))[0].startsWith('۞ '));
});
await test('ordre des mots : mélange différent, validation pas à pas (mots répétés interchangeables)', () => {
  const r = G.rng(7);
  const p = G.orderPuzzle(verse(112, 3), r); // لَمْ يَلِدْ وَلَمْ يُولَدْ
  assert.notEqual(p.shuffled.join(' '), p.words.join(' '));
  assert.deepEqual([...p.shuffled].sort(), [...p.words].sort());
  assert.ok(G.orderStepOk(p, [], 'لَمْ'));
  assert.ok(!G.orderStepOk(p, [], 'يَلِدْ'));
  assert.ok(G.orderDone(p, p.words));
  assert.ok(!G.orderDone(p, p.shuffled));
  // un mot seul : pas de boucle infinie
  assert.deepEqual(G.orderPuzzle('ٱلٓمٓ', r).words, ['ٱلٓمٓ']);
});
await test('mot manquant : la réponse est dans les choix, distracteurs distincts, verset reconstitué', () => {
  const pool = surah(2).slice(0, 40);
  for (let seed = 1; seed < 40; seed++) {
    const r = G.rng(seed);
    const v = pool[seed % pool.length];
    const c = G.clozePuzzle(v, pool, r);
    assert.ok(c);
    assert.equal([...c.before, c.answer, ...c.after].join(' '), v);
    assert.equal(c.options.length, 4);
    assert.ok(c.options.includes(c.answer));
    assert.equal(new Set(c.options.map(G.letterKey)).size, 4);
  }
});
await test('suite du verset : bonne suite parmi les choix, début + suite = verset', () => {
  const pool = surah(114);
  const r = G.rng(3);
  for (const v of pool) {
    const c = G.continuePuzzle(v, pool, r);
    assert.ok(c);
    assert.equal(c.start + ' ' + c.answer, v);
    assert.ok(c.options.includes(c.answer));
    assert.equal(new Set(c.options).size, c.options.length);
  }
});
await test('paliers : versets courts d’abord, palier suivant après 8 réussites', () => {
  const s = surah(2);
  const l0 = G.versesForLevel(s, 0), l2 = G.versesForLevel(s, 2);
  assert.ok(l0.length > 0 && l0.length < l2.length);
  assert.ok(l0.every((x) => G.words(x.v).length <= 6));
  assert.equal(G.levelUp(7, 0), 0);
  assert.equal(G.levelUp(8, 0), 1);
  assert.equal(G.levelUp(8, 2), 2);
});
await test('SM-2 : note selon le déroulé, échéances et file du jour', () => {
  assert.equal(G.gradeOf(0), 'easy');
  assert.equal(G.gradeOf(1), 'medium');
  assert.equal(G.gradeOf(3), 'hard');
  assert.equal(G.gradeOf(0, true), 'hard');
  const keys = ['name:1', 'name:2', 'name:3', 'name:4'];
  let d = {};
  assert.deepEqual(G.dueQueue(d, keys, '2026-11-01', 2), ['name:1', 'name:2']);
  d = G.record(d, 'name:1', 'easy', '2026-11-01');
  d = G.record(d, 'name:2', 'hard', '2026-11-01');
  assert.equal(d['name:1'].d, '2026-11-02');
  assert.equal(d['name:2'].d, '2026-11-02');
  // le jour même : les cartes vues ne reviennent pas ; place aux nouvelles
  assert.deepEqual(G.dueQueue(d, keys, '2026-11-01', 2), ['name:3', 'name:4']);
  // le lendemain : les deux cartes vues sont dues, avant les nouvelles
  assert.deepEqual(G.dueQueue(d, keys, '2026-11-02', 1), ['name:1', 'name:2', 'name:3']);
  d = G.record(d, 'name:1', 'easy', '2026-11-02');
  assert.equal(d['name:1'].d, '2026-11-08'); // SM-2 : 1 j puis 6 j
  assert.deepEqual(G.deckSummary(d, keys, '2026-11-02'), { seen: 2, due: 1, solid: 0, total: 4 });
  // même algorithme que la mémorisation
  assert.deepEqual(d['name:2'], srs.review(undefined, 'hard', '2026-11-01'));
});

// ——— Tajwid ———
const FIX = JSON.parse(readFileSync(new URL('./fixtures/tajweed-112.json', import.meta.url), 'utf8'));
await test('tajwid : lecture des marques, texte rendu identique au texte Tanzil (112:1-3)', () => {
  const segs = T.parseTajweed(FIX.ayahs[0]);
  assert.deepEqual(segs.filter((s) => s.code).map((s) => [s.code, s.t]), [['h', 'ٱ'], ['q', 'د']]);
  for (let i = 0; i < 3; i++) assert.ok(T.aligned(FIX.ayahs[i], verse(112, i + 1)), '112:' + (i + 1));
  assert.equal(T.plainOf(T.parseTajweed('بِسْمِ')), 'بِسْمِ');
});
await test('tajwid : verset non identique à Tanzil (112:4) → pas de couleur', () => {
  assert.equal(T.aligned(FIX.ayahs[3], verse(112, 4)), null);
});
await test('tajwid : mots et familles de règles ; quiz sur un mot à règle unique', () => {
  const segs = T.aligned(FIX.ayahs[2], verse(112, 3));
  const w = T.tajWords(segs);
  assert.equal(w.length, 4);
  assert.deepEqual(w.map((x) => x.groups.join()), ['', 'qalqala', '', 'qalqala']);
  const q = T.colouredWordQuiz([segs], G.rng(1));
  assert.equal(q.answer, 'qalqala');
  assert.equal(q.options.length, 4);
  assert.ok(q.options.includes('qalqala'));
  assert.equal(T.colouredWordQuiz([T.parseTajweed('لَمْ')], G.rng(1)), null);
});
await test('tajwid : désactivé tant que la licence est « YOUR_TAJWID_DATA_LICENSE »', () => {
  assert.equal(T.tajwidColorsAllowed(), false);
  assert.equal(T.tajwidColorsAllowed('YOUR_TAJWID_DATA_LICENSE'), false);
  assert.equal(T.tajwidColorsAllowed('CC BY 4.0 — vérifiée'), true);
  assert.equal(T.TAJWID_SOURCES.length, 3);
});
await test('leçons : exemples lus dans le texte Tanzil (aucun mot recopié), une leçon par règle', () => {
  const ids = T.LESSONS.map((l) => l.id);
  for (const r of ['ghunna', 'izhar', 'idgham-ghunna', 'idgham-bila', 'iqlab', 'ikhfa', 'madd-tabii', 'madd-muttasil', 'madd-lazim', 'qalqala']) assert.ok(ids.includes(r), r);
  const got = {};
  for (const l of T.LESSONS) {
    const v = verse(l.ex.s, l.ex.a);
    const w = G.words(v);
    assert.ok(l.ex.w[1] < w.length, l.id);
    got[l.id] = w.slice(l.ex.w[0], l.ex.w[1] + 1).join(' ');
  }
  // contrôle des lettres attendues (squelette sans voyelles)
  const key = (s) => G.letterKey(s);
  assert.equal(key(got.izhar), 'أنعمت');
  assert.equal(key(got['idgham-ghunna']), 'منيقول');
  assert.equal(key(got.iqlab), 'منبعد');
  assert.equal(key(got.qalqala), 'يلد');
  assert.equal(key(got.shamsiyya), 'وٱلشمس');
  assert.equal(key(got['madd-lazim']), 'ٱلضالين');
  assert.equal(key(got.ikhfa), 'أنت');
  assert.ok(got.iqlab.includes('ۢ'));
});
await test('quiz des définitions : bonne réponse parmi 4 règles distinctes', () => {
  for (let s = 1; s < 30; s++) {
    const q = T.definitionQuiz(G.rng(s));
    assert.equal(new Set(q.options).size, 4);
    assert.ok(q.options.includes(q.answer));
  }
});
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
await test('couleurs tajwid : contraste AA (≥ 4,5:1) sur les fonds clairs et sombres', () => {
  for (const [g, c] of Object.entries(T.GROUP_COLOR)) {
    for (const bg of ['#FFFFFF', '#F7F4EE', '#F0ECE3']) assert.ok(ratio(c.light, bg) >= 4.5, `${g} clair sur ${bg} : ${ratio(c.light, bg).toFixed(2)}`);
    for (const bg of ['#0A1210', '#121D19', '#1A2823']) assert.ok(ratio(c.dark, bg) >= 4.5, `${g} sombre sur ${bg} : ${ratio(c.dark, bg).toFixed(2)}`);
  }
});

console.log(`\n${ok} tests bien-être OK`);
