// Génère src/lib/quran-uthmani.ts (texte Tanzil Uthmani verbatim) et src/lib/quran-meta.ts (métadonnées Tanzil).
// Usage : node scripts/gen-quran-uthmani.mjs /chemin/uthmani.txt /chemin/quran-data.js
import fs from 'node:fs';
import vm from 'node:vm';
const [txt, meta] = process.argv.slice(2);
const T = fs.readFileSync(txt, 'utf8');
const lines = T.split('\n').filter((l) => l && l[0] !== '#');
if (lines.length !== 6236) throw new Error('uthmani: ' + lines.length);
fs.writeFileSync('src/lib/quran-uthmani.ts', `/* eslint-disable */
// GÉNÉRÉ par scripts/gen-quran-uthmani.mjs — ne pas modifier. Texte coranique Tanzil « Uthmani » v1.1 (riwaya Hafs ‘an ‘Asim),
// reproduit à l’identique (format sourate|verset|texte) avec son bloc de copyright. Source : https://tanzil.net — Licence : CC BY 3.0.
// Chargé à la demande (import dynamique) : lecture en écriture uthmanie, hors-ligne.
export const QURAN_UTHMANI: string = ${JSON.stringify(T)};
`);
const ctx = { QuranData: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(meta, 'utf8').replace(/var QuranData\s*=\s*\{\};?/, ''), ctx);
const Q = ctx.QuranData;
const sura = Q.Sura.slice(1, 115);
const off = []; let acc = 0; for (const s of sura) { off.push(acc); acc += s[1]; }
if (acc !== 6236) throw new Error('sura');
const gi = ([s, a]) => off[s - 1] + a - 1;
const pages = Q.Page.slice(1, 605).map(gi);
const juz = Q.Juz.slice(1, 31).map(gi);
const hq = Q.HizbQaurter.slice(1, 241).map(gi);
const manzil = Q.Manzil.slice(1, 8).map(gi);
const sajda = Q.Sajda.slice(1, 16).map((x) => [gi(x), x[2] === 'obligatory' ? 1 : 0]);
if (pages.length !== 604 || juz.length !== 30 || hq.length !== 240 || sajda.length !== 15) throw new Error('meta lengths');
fs.writeFileSync('src/lib/quran-meta.ts', `/* eslint-disable */
// GÉNÉRÉ par scripts/gen-quran-uthmani.mjs — ne pas modifier.
// Dérivé de « Tanzil Quran Metadata » v1.0 — Copyright (C) 2008-2026 Tanzil.net — Licence : Creative Commons Attribution 3.0.
// Index globaux (0..6235) du premier verset de chaque page (Mushaf de Médine, 604 p.), juz’, quart de hizb (rub‘), manzil ; sajdas [index, obligatoire].
export const PAGE_STARTS: number[] = ${JSON.stringify(pages)};
export const JUZ_STARTS: number[] = ${JSON.stringify(juz)};
export const RUB_STARTS: number[] = ${JSON.stringify(hq)};
export const MANZIL_STARTS: number[] = ${JSON.stringify(manzil)};
export const SAJDAS: [number, number][] = ${JSON.stringify(sajda)};
`);
console.log('ok', pages.slice(0, 5), juz.slice(0, 3), sajda.slice(0, 2));
