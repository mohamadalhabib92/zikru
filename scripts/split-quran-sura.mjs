// Découpe le texte Tanzil Uthmani déjà embarqué en 114 modules, un par sourate.
// Le lecteur n’importe ainsi que la sourate ouverte (le fichier complet fait ~1,4 Mo).
// Usage : node scripts/split-quran-sura.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const { QURAN_UTHMANI } = await import(pathToFileURL(path.join(root, 'src/lib/quran-uthmani.ts')).href);
const { SURAHS } = await import(pathToFileURL(path.join(root, 'src/lib/surahs.ts')).href);

const bySurah = Array.from({ length: 114 }, () => []);
for (const line of QURAN_UTHMANI.split('\n')) {
  if (!line || line[0] === '#') continue;
  const i = line.indexOf('|');
  const j = line.indexOf('|', i + 1);
  const s = +line.slice(0, i);
  const text = line.slice(j + 1);
  bySurah[s - 1].push(text);
}
for (let s = 0; s < 114; s++) {
  if (bySurah[s].length !== SURAHS[s][4]) {
    throw new Error(`sourate ${s + 1} : ${bySurah[s].length} versets, attendu ${SURAHS[s][4]}`);
  }
}

const dir = path.join(root, 'src/lib/quran-sura');
fs.mkdirSync(dir, { recursive: true });
const header = `// GÉNÉRÉ par scripts/split-quran-sura.mjs — ne pas modifier.
// Extrait verbatim de Tanzil « Uthmani » v1.1 (Hafs). Source : https://tanzil.net — CC BY 3.0.
// Le texte de chaque verset est recopié tel quel (basmala d’ouverture comprise).
`;
const pads = [];
for (let s = 1; s <= 114; s++) {
  const id = String(s).padStart(3, '0');
  pads.push(id);
  fs.writeFileSync(
    path.join(dir, `s${id}.ts`),
    `${header}export const AYAHS: readonly string[] = ${JSON.stringify(bySurah[s - 1])};\n`,
  );
}
const loaders = pads.map((id) => `  () => import('./s${id}'),`).join('\n');
fs.writeFileSync(
  path.join(dir, 'load.ts'),
  `${header}
export type SurahModule = { AYAHS: readonly string[] };

const LOADERS: (() => Promise<SurahModule>)[] = [
${loaders}
];

const cache = new Map<number, readonly string[]>();
const inflight = new Map<number, Promise<readonly string[]>>();

/** Versets Tanzil bruts de la sourate, déjà en mémoire s’ils ont été lus. */
export function peekSurahRaw(n: number): readonly string[] | null {
  return cache.get(n) ?? null;
}

/** Charge une seule sourate (module séparé, mis en cache pour la suite de la session). */
export function loadSurahRaw(n: number): Promise<readonly string[]> {
  const hit = cache.get(n);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(n);
  if (!p) {
    const load = LOADERS[n - 1];
    if (!load) return Promise.reject(new Error('sourate ' + n));
    p = load().then((m) => {
      cache.set(n, m.AYAHS);
      inflight.delete(n);
      return m.AYAHS;
    });
    inflight.set(n, p);
  }
  return p;
}

/** Sourate suivante, sans attendre : le défilement ou le bouton « suivant » la trouve déjà prête. */
export function preloadSurahRaw(n: number) {
  if (n >= 1 && n <= 114) void loadSurahRaw(n);
}
`,
);
console.log('quran-sura', pads.length, 'fichiers');
