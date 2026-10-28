// Tests des compositions de zikr : abjad des compositions, répétitions, progression, données sources.
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'zikr-'));
const load = (name) => {
  const src = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8').replace(/from '\.\/(\w[\w-]*)'/g, "from './$1.mjs'");
  writeFileSync(
    join(dir, name + '.mjs'),
    ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
  );
};
for (const n of ['abjad', 'zikr', 'names', 'tijani', 'salawat', 'quran-duas', 'duas']) load(n);
const z = await import(join(dir, 'zikr.mjs'));
const N = await import(join(dir, 'names.mjs'));
const S = await import(join(dir, 'salawat.mjs'));
const Q = await import(join(dir, 'quran-duas.mjs'));
const D = await import(join(dir, 'duas.mjs'));

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(ok ? '✓' : '✗', name, ok ? '' : `→ obtenu ${JSON.stringify(got)}, attendu ${JSON.stringify(want)}`);
};
const it = (id, ar, reps) => ({ id, kind: 'free', label: id, ar, reps });

// Données sources
eq('99 Noms', N.NAMES.length, 99);
eq('Noms uniques', new Set(N.NAMES.map((x) => x.ar)).size, 99);
const byTr = (t) => N.NAMES.find((x) => x.tr === t);
eq('Yā Laṭīf = 129', z.itemAbjad({ ar: N.nameBare(byTr('Al-Laṭīf').ar) }, 'mashriqi'), 129);
eq('Yā Wadūd = 20', z.itemAbjad({ ar: N.nameBare(byTr('Al-Wadūd').ar) }, 'mashriqi'), 20);
eq('Yā Raḥmān = 298', z.itemAbjad({ ar: N.nameBare(byTr('Ar-Raḥmān').ar) }, 'mashriqi'), 298);
eq('Allāh = 66', z.itemAbjad({ ar: N.nameBare(N.NAMES[0].ar) }, 'mashriqi'), 66);
eq('Yā Salām : mashriqi 131 / maghribi 371', [z.itemAbjad({ ar: N.nameBare(byTr('As-Salām').ar) }, 'mashriqi'), z.itemAbjad({ ar: N.nameBare(byTr('As-Salām').ar) }, 'maghribi')], [131, 371]);
eq('Yā Laṭīf (forme d’appel)', N.nameCall(byTr('Al-Laṭīf').ar), 'يَا لَطِيفُ');
eq('translit. d’appel', N.nameCallTr('Al-Laṭīf'), 'Yā Laṭīf');
eq('Ṣalawāt ≥ 9', S.SALAWAT.length >= 9, true);
eq('Ṣalawāt : ids uniques', new Set(S.SALAWAT.map((x) => x.id)).size, S.SALAWAT.length);
eq('Ṣalāt al-Fātiḥ reprise du texte tijani', S.SALAWAT.find((x) => x.id === 'tijani-fatih').ar.startsWith('اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ الْفَاتِحِ'), true);
eq('Du‘as coraniques ≥ 40', Q.QURAN_DUAS.length >= 40, true);
eq(
  'Du‘as coraniques : références',
  Q.QURAN_DUAS.every((d) => /^\d+:\d+(-\d+)?$/.test(d.ref) && d.ar && d.fr),
  true,
);
eq('96 du‘as prophétiques', D.DUAS_LIST.length, 96);

// Abjad d’une composition
const items = [it('a', 'يَا لَطِيفُ', 129), it('b', 'اللَّه', 3), it('c', 'شَمْس', 2)];
// يا = 11 ; يا لطيف = 140
const m = z.compositionTotals(items, 'mashriqi');
eq(
  'abjad par élément (mashriqi)',
  m.items.map((x) => x.abjad),
  [140, 66, 400],
);
eq('total par récitation (mashriqi)', m.perRecitation, 606);
eq('total × répétitions (mashriqi)', m.withReps, 140 * 129 + 66 * 3 + 400 * 2);
eq('répétitions totales', m.totalReps, 134);
const g = z.compositionTotals(items, 'maghribi');
eq('total par récitation (maghribi)', g.perRecitation, 140 + 66 + 1340);
eq('total × répétitions (maghribi)', g.withReps, 140 * 129 + 66 * 3 + 1340 * 2);
eq('option ة = ت', z.compositionTotals([it('r', 'رَحْمَة', 2)], 'mashriqi', { taMarbuta: 'ta' }).withReps, 1296);
eq('composition vide', z.compositionTotals([], 'mashriqi'), {
  perRecitation: 0,
  withReps: 0,
  totalReps: 0,
  items: [],
});

// Répétitions
eq('abjad → répétitions (Laṭīf)', z.abjadAsReps(it('l', 'لطيف', 1), 'mashriqi').reps, 129);
eq('abjad → répétitions (Wadūd)', z.abjadAsReps(it('w', 'ودود', 1), 'mashriqi').reps, 20);
const lat = byTr('Al-Laṭīf');
const nameItem = {
  id: 'n',
  kind: 'name',
  label: 'Yā Laṭīf',
  ar: N.nameCall(lat.ar),
  abjadAr: N.nameBare(lat.ar),
  reps: 1,
};
eq('Nom : abjad sans « yā » → 129 répétitions', z.abjadAsReps(nameItem, 'mashriqi').reps, 129);
eq('Nom : Yā Laṭīf × 129 = 16641', z.compositionTotals([{ ...nameItem, reps: 129 }], 'mashriqi').withReps, 16641);
eq('abjad → répétitions (texte latin → 1)', z.abjadAsReps(it('x', 'abc', 7), 'mashriqi').reps, 1);
eq('clampReps', [z.clampReps(0), z.clampReps(-5), z.clampReps(2.6), z.clampReps(NaN), z.clampReps(1e9)], [1, 1, 3, 1, 100000]);

// Édition
const L3 = [it('a', 'ا', 1), it('b', 'ب', 2), it('c', 'ج', 3)];
eq(
  'monter',
  z.moveItem(L3, 1, -1).map((x) => x.id),
  ['b', 'a', 'c'],
);
eq(
  'descendre',
  z.moveItem(L3, 1, 1).map((x) => x.id),
  ['a', 'c', 'b'],
);
eq(
  'bornes',
  z.moveItem(L3, 0, -1).map((x) => x.id),
  ['a', 'b', 'c'],
);
eq(
  'supprimer',
  z.removeItem(L3, 0).map((x) => x.id),
  ['b', 'c'],
);
eq(
  'dupliquer',
  z.duplicateItem(L3, 1, 'b2').map((x) => `${x.id}:${x.reps}`),
  ['a:1', 'b:2', 'b2:2', 'c:3'],
);

// Pratique
const P = [it('a', 'ا', 3), it('b', 'ب', 2), it('c', 'ج', 1)];
eq('progression initiale', z.progress(P, 0, 0), {
  done: 0,
  total: 6,
  ratio: 0,
});
eq('progression étape 2', z.progress(P, 1, 1).done, 4);
eq('progression terminée', z.progress(P, 3, 0).ratio, 1);
let r = z.advance(P, { step: 0, count: 0 }, 2);
eq('avance simple', [r.state, r.completed, r.finished], [{ step: 0, count: 2 }, [], false]);
r = z.advance(P, r.state, 1);
eq('étape complétée', [r.state, r.completed], [{ step: 1, count: 0 }, [0]]);
r = z.advance(P, { step: 0, count: 2 }, 4);
eq('appuis groupés : report sur les étapes suivantes', [r.state, r.completed, r.finished], [{ step: 3, count: 0 }, [0, 1, 2], true]);
r = z.advance(P, { step: 0, count: 2 }, 2);
eq('report partiel', [r.state, r.completed], [{ step: 1, count: 1 }, [0]]);
r = z.advance(P, { step: 3, count: 0 }, 5);
eq('après la fin : rien', [r.state, r.completed], [{ step: 3, count: 0 }, []]);
eq('zéro appui', z.advance(P, { step: 1, count: 1 }, 0).state, {
  step: 1,
  count: 1,
});

// Suivi et export
const Z = {
  id: 'z',
  name: 'Test',
  niyya: 'Pour Allah',
  items: P,
  createdAt: '',
  updatedAt: '',
};
eq('markDone ×2', z.markDone(z.markDone(Z, '2026-10-28'), '2026-10-28').done, {
  '2026-10-28': 2,
});
const txt = z.exportText({ ...Z, items: [it('l', 'يَا لَطِيفُ', 129)] }, ['mashriqi', 'maghribi']);
eq('export : total', txt.includes('Total abjad mashriqi : 140 par récitation · 18060 avec les répétitions'), true);
eq('export : intention', txt.includes('Intention : Pour Allah'), true);

if (fail) {
  console.error(`${fail} échec(s)`);
  process.exit(1);
}
console.log('Zikr : tous les tests passent.');
