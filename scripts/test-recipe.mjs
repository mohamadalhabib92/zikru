// Recette photographiée ou collée : étapes, dédicaces, prérequis, invocation. Arabe, français, anglais.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'recipe-parse': R } = await loadLib(['recipe-parse'], 'recipe');

const AR = `كيفية خاصة في التوسل بالشيخ
رضي الله عنه

ومن فوائد سيدي العربي بن السائح رضي الله عنه، قال: من أراد أن تُقضى له حاجته، فليصل ركعتين ويقرأ في كل ركعة سورة الفاتحة فقط، وبعد السلام.

يقرأ سورة الفاتحة 3 مرات، وصلاة الفاتح 3 مرات، ويهدي ثوابها
لروح الخليفة المتصرف في الوقت والبلاد.

ثم يقرأ سورة الفاتحة 4 مرات، وصلاة الفاتح 4 مرات، لروح
الواسطة المعظم سيدي محمد بن العربي الدمراوي التازي رضي الله عنه.

ثم يقرأ سورة الفاتحة 5 مرات، وصلاة الفاتح 5 مرات، لروح أولاد
الشيخ رضي الله عنهم.

ثم يقرأ سورة الفاتحة 6 مرات، وصلاة الفاتح 6 مرات، لروح الخليفة
المعظم سيدي الحاج علي حرازم رضي الله عنه.

ثم يقرأ سورة الفاتحة 7 مرات، وصلاة الفاتح 7 مرات، لروح مولانا
الشيخ سيدي أحمد التجاني رضي الله عنه.

ثم تطلب الله في حاجتك تُقضى بإذن الله فتقول:
يا الله يا رحمان يا ودود يا غياث المستغيثين أغثني بحق النبي صلى
الله عليه وسلم وبحق اسمك الرحمن 7 مرات.

وفي رواية حذف الركعتين، وبمجموع الأعداد 50 وهو عدد هذه الأسماء.
واحد أحد حي.
والله أعلم.

الشيخ أبو بكر ابن إبراهيم به التجاني
لطف الله به آمين
`;

const r = R.parseRecipe(AR);
assert.equal(r.recognized, true);
assert.match(r.title, /كيفية خاصة في التوسل بالشيخ/);
assert.match(r.title, /رضي الله عنه/);
assert.match(r.sourceName, /السائح/);
assert.match(r.aim, /حاج/);
assert.match(r.variant, /حذف الركعتين/);
assert.equal(r.namedTotal, 50);
assert.equal(r.countedTotal, 50);
assert.match(r.namesNote, /حي/);
assert.match(r.signature, /أبو بكر/);

const steps = r.stages.filter((s) => s.kind === 'step');
assert.equal(steps.length, 5, 'cinq étapes');
assert.deepEqual(steps.map((s) => s.formulas.map((f) => f.id)), [
  ['fatiha', 'fatih'],
  ['fatiha', 'fatih'],
  ['fatiha', 'fatih'],
  ['fatiha', 'fatih'],
  ['fatiha', 'fatih'],
]);
assert.deepEqual(steps.map((s) => s.formulas.map((f) => f.count)), [
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [7, 7],
]);
assert.match(steps[0].dedication, /المتصرف/);
assert.match(steps[1].dedication, /الدمراوي/);
assert.match(steps[2].dedication, /أولاد/);
assert.match(steps[3].dedication, /حرازم/);
assert.match(steps[4].dedication, /التجاني/);
assert.ok(steps.every((s) => s.confidence >= 0.85));
assert.ok(steps[0].formulas[0].ar.includes('بِسْمِ'), 'la Fatiha est le texte de référence');
assert.ok(steps[0].formulas[1].ar.includes('الْفَاتِحِ'), 'Salat al-Fatih est le texte de référence');

const pre = r.stages.filter((s) => s.kind === 'prerequisite');
assert.equal(pre.length, 1);
assert.equal(pre[0].optional, true);
assert.equal(pre[0].formulas[0].id, 'fatiha');
assert.equal(pre[0].formulas[0].count, 2);

const inv = r.stages.find((s) => s.kind === 'invocation');
assert.ok(inv);
assert.equal(inv.formulas[0].count, 7);
assert.match(inv.formulas[0].ar, /يا الله يا رحمان/);
assert.match(inv.formulas[0].ar, /اسمك الرحمن/);
assert.equal(r.countedTotal, steps.reduce((a, s) => a + s.formulas.reduce((b, f) => b + f.count, 0), 0));
assert.ok(!inv.formulas[0].ar.includes('7'), 'le nombre ne reste pas dans le texte de l’invocation');

const flat = R.recipeFlat(r);
assert.equal(flat.filter((x) => x.stage.kind === 'step').reduce((a, x) => a + x.formula.count, 0), 50);

const FR = `Source : fawa'id de Sidi al-Arabi ibn al-Sa'ih.
But : obtenir une hajah.
Optionnel : 2 rak'as, dans chacune la Fatiha seule.
Variante : sans les 2 rak'as.
Puis Al-Fatiha ×3 puis Salat al-Fatih ×3, dédié à l'âme du Khalifa.
Puis Al-Fatiha 4 fois et Salat al-Fatih 4 fois, pour Sidi Muhammad.
Puis dire 7 fois : Ya Allah, secours-moi.
`;
const fr = R.parseRecipe(FR);
assert.equal(fr.recognized, true);
assert.match(fr.sourceName, /fawa/i);
assert.match(fr.aim, /hajah/);
assert.match(fr.variant, /sans les 2 rak/);
const frSteps = fr.stages.filter((s) => s.kind === 'step');
assert.equal(frSteps.length, 2);
assert.deepEqual(frSteps[0].formulas.map((f) => [f.id, f.count]), [['fatiha', 3], ['fatih', 3]]);
assert.match(frSteps[0].dedication, /Khalifa/);
assert.deepEqual(frSteps[1].formulas.map((f) => f.count), [4, 4]);
assert.equal(fr.stages.filter((s) => s.kind === 'prerequisite').length, 1);
assert.equal(fr.stages.find((s) => s.kind === 'invocation').formulas[0].count, 7);
assert.match(fr.stages.find((s) => s.kind === 'invocation').formulas[0].ar, /Ya Allah/);

const EN = `Source: fawa'id of Sidi al-Arabi ibn al-Sa'ih.
Aim: a hajah.
Optional: 2 rak'as, Fatiha only in each.
Variant: without the 2 rak'as.
Then Al-Fatiha ×3 then Salat al-Fatih ×3, offered to the soul of the Khalifa.
Then say ×7: Ya Allah, help me.
`;
const en = R.parseRecipe(EN);
assert.equal(en.recognized, true);
assert.equal(en.stages.filter((s) => s.kind === 'step').length, 1);
assert.deepEqual(en.stages.find((s) => s.kind === 'step').formulas.map((f) => [f.id, f.count]), [['fatiha', 3], ['fatih', 3]]);
assert.match(en.stages.find((s) => s.kind === 'step').dedication, /Khalifa/);
assert.equal(en.stages.find((s) => s.kind === 'invocation').formulas[0].count, 7);
assert.match(en.variant, /without the 2/);
assert.equal(en.stages.find((s) => s.kind === 'prerequisite').optional, true);

const digits = R.parseRecipe('يقرأ سورة الفاتحة ٣ مرات، وصلاة الفاتح ٣ مرات، لروح الشيخ.\nثم يقرأ سورة الفاتحة ٤ مرات، وصلاة الفاتح ٤ مرات، لروح الأولاد.');
assert.equal(digits.countedTotal, 14);
assert.deepEqual(digits.stages.filter((s) => s.kind === 'step').map((s) => s.formulas.map((f) => f.count)), [[3, 3], [4, 4]]);

console.log('recette : 5 étapes, prérequis, invocation ×7, total 50, français et anglais OK');
