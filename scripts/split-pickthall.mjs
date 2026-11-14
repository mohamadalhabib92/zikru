// Découpe la traduction Pickthall (domaine public, 1930) en un module par sourate.
// Le texte n’est pas modifié. Source : api.alquran.cloud édition en.pickthall.
// Usage : node scripts/split-pickthall.mjs /chemin/pickthall.json
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) throw new Error('chemin du JSON alquran.cloud manquant');
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const surahs = j.data.surahs;
if (surahs.length !== 114) throw new Error('sourates ' + surahs.length);
const total = surahs.reduce((n, s) => n + s.ayahs.length, 0);
if (total !== 6236) throw new Error('versets ' + total);

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'src/lib/quran-tr/pickthall');
fs.mkdirSync(dir, { recursive: true });
const header = `// GÉNÉRÉ par scripts/split-pickthall.mjs — ne pas modifier.
// Marmaduke Pickthall, The Meaning of the Glorious Koran (1930), domaine public.
// Texte recopié tel quel depuis l’édition en.pickthall d’api.alquran.cloud. Aucune réécriture.
`;
for (const s of surahs) {
  const id = String(s.number).padStart(3, '0');
  const lines = s.ayahs.map((a) => a.text.replace(/\s*\n\s*/g, ' ').trim());
  fs.writeFileSync(path.join(dir, `s${id}.ts`), `${header}export const AYAHS: readonly string[] = ${JSON.stringify(lines)};\n`);
}
const loaders = surahs.map((s) => `  () => import('./s${String(s.number).padStart(3, '0')}'),`).join('\n');
fs.writeFileSync(
  path.join(dir, 'load.ts'),
  `${header}
const LOADERS: (() => Promise<{ AYAHS: readonly string[] }>)[] = [
${loaders}
];

const cache = new Map<number, readonly string[]>();

export function loadPickthallSurah(n: number): Promise<readonly string[]> {
  const hit = cache.get(n);
  if (hit) return Promise.resolve(hit);
  const load = LOADERS[n - 1];
  if (!load) return Promise.reject(new Error('sourate ' + n));
  return load().then((m) => {
    cache.set(n, m.AYAHS);
    return m.AYAHS;
  });
}
`,
);
const bytes = fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
console.log('pickthall', surahs.length, 'fichiers', bytes, 'octets');
