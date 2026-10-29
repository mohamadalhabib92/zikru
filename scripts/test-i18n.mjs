// CI i18n : échoue si l'anglais ou l'arabe manque une clé du français, ou si un écran couvert
// contient une chaîne française codée en dur absente du catalogue (i18n/*.tsv → src/lib/ui-strings.ts).
// Usage : node scripts/test-i18n.mjs [--list]   (--list : affiche les chaînes manquantes)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLib } from './load-lib.mjs';
import { extractDeep, walk } from './i18n-scan.mjs';

const { i18n, 'ui-strings': U } = await loadLib(['i18n', 'ui-strings'], 'i18n');
const AR = /[\u0600-\u06FF]/;
const norm = (s) => s.replace(/\s+/g, ' ').trim();

// 1) Dictionnaires typés : parité en/ar vs fr, valeurs non vides, arabe en écriture arabe.
const fr = i18n.DICTS.fr;
const miss = { en: [], ar: [] };
for (const l of ['en', 'ar']) {
  const d = i18n.DICTS[l];
  for (const k of Object.keys(fr)) {
    const v = d[k];
    if (typeof fr[k] !== 'string') continue;
    if (typeof v !== 'string' || !v.trim()) miss[l].push(k);
    else if (l === 'ar' && fr[k].trim() && /[A-Za-zÀ-ÿ]{3}/.test(fr[k]) && !AR.test(v)) miss[l].push(k + ' (pas d’arabe)');
  }
  for (const k of Object.keys(d)) if (!(k in fr)) miss[l].push(k + ' (clé inconnue en fr)');
}
assert.deepEqual(miss.en, [], 'clés en manquantes : ' + miss.en.join(', '));
assert.deepEqual(miss.ar, [], 'clés ar manquantes : ' + miss.ar.join(', '));

// 2) Catalogue : chaque entrée a en + ar (arabe en écriture arabe), mêmes variables {…}.
const CAT = U.UI_STRINGS;
for (const [k, [en, ar]] of Object.entries(CAT)) {
  assert.ok(en && en.trim(), 'catalogue : en vide pour « ' + k + ' »');
  assert.ok(ar && AR.test(ar), 'catalogue : ar sans arabe pour « ' + k + ' »');
}

// 3) Écrans couverts (P5) : toute chaîne française doit être au catalogue (ou dans i18n/keep.txt).
const KEEP = new Set(readFileSync(new URL('../i18n/keep.txt', import.meta.url), 'utf8').split('\n').map(norm).filter((x) => x && !x.startsWith('#')));
const REQUIRED = readFileSync(new URL('../i18n/required.txt', import.meta.url), 'utf8').split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
const known = (s) => KEEP.has(s) || s in CAT;
const all = [...walk('src/app'), ...walk('src/components'), ...walk('src/ui')];
const bad = [];
let tot = 0, ok = 0;
for (const f of all) {
  for (const x of extractDeep(f)) {
    const s = norm(x.s);
    const good = x.tpl ? KEEP.has(s) : known(s);
    tot++;
    if (good) ok++;
    if (REQUIRED.includes(f) && !good && !(x.tpl && x.wrapped)) bad.push(`${f}:${x.line}  ${x.tpl ? '[gabarit → L()] ' : ''}${s}`);
  }
}
const dictN = Object.keys(fr).length;
console.log(`i18n : dictionnaires en/ar ${dictN}/${dictN} clés · catalogue ${Object.keys(CAT).length} chaînes · chaînes d’interface traduites ${ok}/${tot} (${Math.round((ok / tot) * 100)} %) · écrans couverts ${REQUIRED.length}`);
if (process.argv.includes('--list')) console.log(bad.join('\n'));
assert.equal(bad.length, 0, `${bad.length} chaîne(s) française(s) non traduite(s) dans les écrans couverts :\n` + bad.slice(0, 40).join('\n'));
console.log('test-i18n OK');
