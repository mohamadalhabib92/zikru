// Tests du classement des « lettres lumineuses » (src/lib/nuraniyya.ts) sur le texte Tanzil uthmani embarqué.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLib } from './load-lib.mjs';

const { nuraniyya: N } = await loadLib(['nuraniyya'], 'nur');
// 14 lettres, distinctes, = lettres de la formule نص حكيم قاطع له سر (alif de قاطع, yā’ de حكيم).
assert.equal(N.NURANI_LETTERS.length, 14);
assert.equal(new Set(N.NURANI_LETTERS).size, 14);
const bare = (s) => [...s].filter((c) => !N.isMark(c) && c !== ' ').join('');
assert.deepEqual([...new Set(bare(N.NURANI_MNEMONIC))].sort(), [...N.NURANI_LETTERS].sort(), 'la formule contient exactement les 14 lettres');
// Les 14 autres lettres de l’alphabet ne sont pas lumineuses.
for (const c of 'بتثجخدذزشضظغفو') assert.equal(N.isNurani(c), false, c);
for (const c of N.NURANI_LETTERS) assert.equal(N.isNurani(c), true, c);
// Formes d’alif (tracé alif) → oui ; hamza isolée / sur wāw / sur yā’ → non ; ى → oui (yā’) ; ة → non.
for (const c of ['ٱ', 'آ', 'أ', 'إ', 'ى']) assert.equal(N.isNurani(c), true, c);
for (const c of ['ء', 'ؤ', 'ئ', 'ة']) assert.equal(N.isNurani(c), false, c);
// Signes : jamais des lettres (fatha, shadda, alif suscrit, madda coranique, petit yā’, tatwil).
for (const c of ['\u064E', '\u0651', '\u0670', '\u0653', '\u06E6', '\u0640']) assert.equal(N.isMark(c), true, c.codePointAt(0).toString(16));

// Le découpage ne modifie jamais le texte : concaténation identique, sur les 6236 versets.
const src = readFileSync(new URL('../src/lib/quran-uthmani.ts', import.meta.url), 'utf8');
const ayahs = src.split(/\\n|\n/).map((l) => l.replace(/^.*[`'"](?=1\|1\|)/, "")).filter((l) => /^\d+\|\d+\|/.test(l)).map((l) => { const [s, a, ...t] = l.split('|'); return { s: +s, a: +a, t: t.join('|') }; });
assert.equal(ayahs.length, 6236);
let total = 0;
for (const { t } of ayahs) {
  const segs = N.segmentNurani(t);
  assert.equal(segs.map((x) => x.t).join(''), t);
  for (let i = 1; i < segs.length; i++) assert.notEqual(segs[i].on, segs[i - 1].on, 'segments alternés');
  // Aucun segment ne commence par un signe (le signe reste avec sa lettre).
  for (const x of segs) if (x !== segs[0]) assert.equal(N.isMark([...x.t][0]), false);
  total += N.countNurani(t);
}
assert.ok(total > 100000, 'nombre plausible de lettres lumineuses : ' + total);
// Al-Fatiha 1:2 « ٱلْحَمْدُ لِلَّهِ » : ٱ ل ح م (lumineuses), د non…
const f = N.segmentNurani('ٱلْحَمْدُ');
assert.deepEqual(f.map((x) => x.on), [true, false]);
assert.equal(f[0].t, 'ٱلْحَمْ');

// Lettres isolées : 29 sourates, préfixe détecté au verset 1 (basmala retirée) et 42:2.
assert.equal(N.MUQATTAAT_SURAHS.length, 29);
const strip = (t) => (t.startsWith('بِسْمِ') ? t.split(' ').slice(4).join(' ') : t); // comme stripBasmala (lecteur)
const get = (s, a) => strip(ayahs.find((x) => x.s === s && x.a === a).t);
const expect = { 2: 'الٓمٓ', 7: 'الٓمٓصٓ', 10: 'الٓر', 13: 'الٓمٓر', 19: 'كٓهيعٓصٓ', 20: 'طه', 26: 'طسٓمٓ', 27: 'طسٓ', 36: 'يسٓ', 38: 'صٓ', 40: 'حمٓ', 42: 'حمٓ', 50: 'قٓ', 68: 'نٓ' };
for (const [s, w] of Object.entries(expect)) assert.equal(get(+s, 1).slice(0, N.muqattaatPrefix(+s, 1, get(+s, 1))), w, 'sourate ' + s);
for (const s of N.MUQATTAAT_SURAHS) assert.ok(N.muqattaatPrefix(s, 1, get(s, 1)) > 0, 'préfixe en ' + s);
assert.equal(get(42, 2).slice(0, N.muqattaatPrefix(42, 2, get(42, 2))), 'عٓسٓقٓ');
assert.equal(N.muqattaatPrefix(1, 1, get(1, 2)), 0);
assert.equal(N.muqattaatPrefix(2, 2, get(2, 2)), 0);
console.log(`test-nuraniyya OK (${total} lettres lumineuses dans le texte, 29 ouvertures)`);
