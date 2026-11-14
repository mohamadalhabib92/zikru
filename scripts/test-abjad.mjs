// Tests du calculateur abjad (sans dépendance de test) : transpile src/lib/abjad.ts puis vérifie les deux systèmes.
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const src = readFileSync(new URL('../src/lib/abjad.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const f = join(mkdtempSync(join(tmpdir(), 'abjad-')), 'abjad.mjs');
writeFileSync(f, js);
const m = await import(f);

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(ok ? '✓' : '✗', name, ok ? '' : `→ obtenu ${JSON.stringify(got)}, attendu ${JSON.stringify(want)}`);
};
const T = (s, sys, o) => m.computeAbjad(s, sys, o).total;

// Tables
eq('28 lettres par système', [Object.keys(m.MASHRIQI).length, Object.keys(m.MAGHRIBI).length], [28, 28]);
eq('6 lettres diffèrent', m.DIFF_LETTERS.sort(), ['س', 'ش', 'ص', 'ض', 'ظ', 'غ'].sort());
eq('somme des 28 lettres (mashriqi)', Object.values(m.MASHRIQI).reduce((a, b) => a + b, 0), 5995);
eq('somme des 28 lettres (maghribi)', Object.values(m.MAGHRIBI).reduce((a, b) => a + b, 0), 5995);
eq('valeurs maghribi', ['ص', 'ض', 'س', 'ظ', 'غ', 'ش'].map((c) => m.MAGHRIBI[c]), [60, 90, 300, 800, 900, 1000]);
eq('valeurs mashriqi', ['ص', 'ض', 'س', 'ظ', 'غ', 'ش'].map((c) => m.MASHRIQI[c]), [90, 800, 60, 900, 1000, 300]);

// Exemples
for (const sys of ['mashriqi', 'maghribi']) {
  eq(`الله = 66 (${sys})`, T('اللَّه', sys), 66);
  eq(`محمد = 92 (${sys})`, T('مُحَمَّد', sys), 92);
  eq(`tatweel ignoré (${sys})`, T('اللــــه', sys), 66);
  eq(`آدم = 45 (${sys})`, T('آدَم', sys), 45);
  eq(`مؤمن = 136 (${sys})`, T('مُؤْمِن', sys), 136);
  eq(`رحمة = 253 (ة = ه) (${sys})`, T('رَحْمَة', sys), 253);
  eq(`رحمة = 648 (ة = ت) (${sys})`, T('رَحْمَة', sys, { taMarbuta: 'ta' }), 648);
}
eq('بسملة (mashriqi) = 786', T('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 'mashriqi'), 786);
eq('بسملة (maghribi) = 1026', T('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 'maghribi'), 1026);
eq('شمس : 400 / 1340', [T('شمس', 'mashriqi'), T('شمس', 'maghribi')], [400, 1340]);
eq('صلاة : 126 / 96', [T('صلاة', 'mashriqi'), T('صلاة', 'maghribi')], [126, 96]);
eq('غظض : 2700 / 1790', [T('غظض', 'mashriqi'), T('غظض', 'maghribi')], [2700, 1790]);
eq('سماء : ء = 1 → 102 / 342', [T('سماء', 'mashriqi'), T('سماء', 'maghribi')], [102, 342]);
eq('سماء : ء = 0 → 101', T('سماء', 'mashriqi', { hamza: 0 }), 101);
eq('ى → ي : موسى = 116', T('مُوسَى', 'mashriqi'), 116);
eq('ئ → ي : شيء/شئ', T('شئ', 'mashriqi'), 310);

// Détail
const r = m.computeAbjad('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 'mashriqi');
eq('sommes par mot', r.words.map((w) => w.total), [102, 66, 329, 289]);
eq('19 lettres', r.letters.length, 19);
eq('racine numérique 786 → 3', r.root, 3);
eq('racine numérique 1026 → 9', m.digitalRoot(1026), 9);
eq('racine de 0', m.digitalRoot(0), 0);
eq('texte latin ignoré', m.computeAbjad('abc', 'mashriqi').total, 0);
eq('normalisation', m.normalizeArabic('إِبْرَاهِيمُ'), 'ابراهيم');
eq('رحمن = 298 (mashriqi)', T('رحمن', 'mashriqi'), 298);
eq('واحد أحد حي = 50', T('واحد أحد حي', 'mashriqi'), 50);
eq('chiffres arabes ignorés', T('الله١٢٣', 'mashriqi'), 66);
eq('chiffres latins ignorés', T('الله 66', 'mashriqi'), 66);
eq('آ = 1 par défaut (آدم = 45)', T('آدم', 'mashriqi', { madda: 'one' }), 45);
eq('آ = 2 si on le demande (آدم = 46)', T('آدم', 'mashriqi', { madda: 'two' }), 46);
eq('shadda une fois : محمد = 92', T('مُحَمَّد', 'mashriqi', { shadda: 'once' }), 92);
eq('shadda deux fois : محمد = 132', T('مُحَمَّد', 'mashriqi', { shadda: 'twice' }), 132);
eq('alif waslah = 1', T('ٱله', 'mashriqi'), 36);
eq('alif waslah ignoré', T('ٱله', 'mashriqi', { wasl: 'zero' }), 35);
eq('lam-alif ligature = 31', T('ﻻ', 'mashriqi'), 31);
const allah = m.computeAbjad('الله', 'mashriqi');
eq('réduction 66 → 12', allah.digitSum, 12);
eq('racine 66 → 3', allah.root, 3);
eq('saghir de الله (ا 1، ل 3، ل 3، ه 5)', allah.saghir, 12);

if (fail) {
  console.error(`${fail} échec(s)`);
  process.exit(1);
}
console.log('Abjad : tous les tests passent.');
