// Extrait les du‘as coraniques déjà listées dans quran-duas.ts depuis les mêmes versets
// des éditions QuranEnc citées. Ne touche pas au texte arabe. Ne réécrit pas le sens.
// Usage : node scripts/gen-quran-dua-enc.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const KEYS = [
  'german_bubenheim',
  'fulani_rwwad',
  'turkish_shahin',
  'urdu_junagarhi',
  'indonesian_affairs',
  'persian_ih',
  'hausa_gummi',
  'swahili_barawani',
  'spanish_garcia',
  'italian_rwwad',
  'portuguese_nasr',
];

const src = readFileSync(new URL('../src/lib/quran-duas.ts', import.meta.url), 'utf8');
const marker = 'export const QURAN_DUAS: QuranDua[] = ';
const duas = JSON.parse(src.slice(src.indexOf(marker) + marker.length).replace(/;\s*$/, ''));
const parse = (ref) => {
  const [s, r] = ref.split(':');
  const [a0, a1] = r.split('-').map(Number);
  return { s: Number(s), a0, a1: a1 || a0 };
};
const surahs = [...new Set(duas.map((d) => parse(d.ref).s))].sort((a, b) => a - b);
const cache = {};

for (const key of KEYS) {
  cache[key] = {};
  for (const s of surahs) {
    let j;
    for (let n = 0; n < 6; n++) {
      const r = await fetch(`https://quranenc.com/api/v1/translation/sura/${key}/${s}`);
      if (r.ok) {
        j = await r.json();
        break;
      }
      await new Promise((res) => setTimeout(res, 400 * (n + 1)));
    }
    if (!j?.result?.length) throw new Error(`${key} sourate ${s} vide`);
    cache[key][s] = j.result;
    process.stdout.write('.');
  }
}

const out = {};
for (const d of duas) {
  const { s, a0, a1 } = parse(d.ref);
  out[d.id] = {};
  for (const key of KEYS) {
    const rows = cache[key][s]
      .filter((row) => {
        const a = Number(row.aya);
        return a >= a0 && a <= a1;
      })
      .sort((a, b) => Number(a.aya) - Number(b.aya));
    if (rows.length !== a1 - a0 + 1) throw new Error(`${d.id} ${key} : ${rows.length} versets`);
    if (rows.some((row) => !String(row.translation ?? '').trim())) throw new Error(`${d.id} ${key} : sens vide`);
    const text = rows.map((row) => String(row.translation).trim()).join(' ');
    const notes = rows.map((row) => row.footnotes).filter((x) => x != null && String(x).trim()).map((x) => String(x).trim());
    out[d.id][key] = notes.length ? `${text}\n\n${notes.join('\n')}` : text;
  }
}

const head = `/** Sens des du‘as coraniques — GÉNÉRÉ par scripts/gen-quran-dua-enc.mjs depuis QuranEnc.\n * Même versets que quran-duas.ts. Texte copié tel que publié (notes après une ligne vide). Ne pas éditer à la main.\n * Clé interne = identifiant QuranEnc. Le wolof n’est pas ici.\n */\n`;
writeFileSync(
  new URL('../src/lib/i18n-content/quran-dua-enc.ts', import.meta.url),
  head + `export const QURAN_DUA_ENC: Record<string, Record<string, string>> = ${JSON.stringify(out, null, 1)};\n`,
);
console.log('\n', duas.length, 'du‘as ×', KEYS.length, 'éditions');
