// Ouverture d’une sourate : le texte affiché ne doit plus attendre le fichier entier (~1,4 Mo).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');

function measure(file, check) {
  const code = `
const { performance } = require('node:perf_hooks');
const t = performance.now();
const m = require(${JSON.stringify(file)});
const n = (m.AYAHS || []).length || (m.QURAN_UTHMANI ? m.QURAN_UTHMANI.split('\\n').filter((l) => l && l[0] !== '#').length : 0);
if (!(${check})) process.exit(2);
console.log(performance.now() - t);
`;
  const r = spawnSync(process.execPath, ['-e', code], { cwd: root, encoding: 'utf8' });
  if (r.status) throw new Error(r.stderr || r.stdout);
  const ms = Number(r.stdout.trim().split('\n').pop());
  assert.ok(Number.isFinite(ms), 'mesure ' + file);
  return ms;
}

function median(file, check) {
  const xs = Array.from({ length: 5 }, () => measure(file, check)).sort((a, b) => a - b);
  return xs[2];
}

const whole = median('./src/lib/quran-uthmani.ts', 'n === 6236');
const fatiha = median('./src/lib/quran-sura/s001.ts', 'n === 7');
const baqara = median('./src/lib/quran-sura/s002.ts', 'n === 286');
const fullBytes = (await import('node:fs')).statSync(path.join(root, 'src/lib/quran-uthmani.ts')).size;
const fatihaBytes = (await import('node:fs')).statSync(path.join(root, 'src/lib/quran-sura/s001.ts')).size;
const baqaraBytes = (await import('node:fs')).statSync(path.join(root, 'src/lib/quran-sura/s002.ts')).size;

assert.ok(fullBytes > 1_000_000 && fatihaBytes < 8_000 && baqaraBytes < 120_000);
assert.ok(fullBytes / fatihaBytes > 100, 'le module entier est plus de 100 fois plus gros que la Fatiha');
assert.ok(fatiha < 80 && baqara < 80, `sourate seule trop lente (${fatiha.toFixed(1)} / ${baqara.toFixed(1)} ms)`);
assert.ok(whole - fatiha >= 15, `le fichier entier doit coûter au moins 15 ms de plus (${whole.toFixed(1)} − ${fatiha.toFixed(1)})`);

const { QURAN_UTHMANI } = await import(pathToFileURL(path.join(root, 'src/lib/quran-uthmani.ts')).href);
const { SURAHS } = await import(pathToFileURL(path.join(root, 'src/lib/surahs.ts')).href);
const { AYAHS: f } = await import(pathToFileURL(path.join(root, 'src/lib/quran-sura/s001.ts')).href);
const { AYAHS: b } = await import(pathToFileURL(path.join(root, 'src/lib/quran-sura/s002.ts')).href);
const raw = (s) =>
  QURAN_UTHMANI.split('\n')
    .filter((l) => l.startsWith(s + '|'))
    .map((l) => l.slice(l.indexOf('|', l.indexOf('|') + 1) + 1));
assert.deepEqual([...f], raw(1));
assert.deepEqual([...b], raw(2));
assert.equal(f.length, SURAHS[0][4]);
assert.equal(b.length, SURAHS[1][4]);
assert.ok(b[0].includes('بِسْمِ'), 'le verset 2:1 garde la basmala Tanzil dans le module');
const bare = (s) => s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627');
const w = b[0].split(/\s+/);
assert.ok(w.length > 4 && bare(w[0]) === 'بسم', 'la basmala d’ouverture est toujours retirée à l’affichage, pas dans le fichier');

const screen = await import('node:fs').then((fs) => fs.readFileSync(path.join(root, 'src/app/quran/[n].tsx'), 'utf8'));
assert.ok(screen.includes('useSurahUthmani'), 'le lecteur charge une sourate, pas les 6236 versets');
assert.ok(!screen.includes('initialNumToRender={Math.max(12, startA + 4)}'), 'ouvrir un verset loin ne rend plus toute la sourate');
assert.ok(screen.includes('initialNumToRender={8}'));

console.log(
  `ouverture Coran : fichier entier ${whole.toFixed(1)} ms (${Math.round(fullBytes / 1024)} Ko) → ` +
    `Fatiha ${fatiha.toFixed(1)} ms (${Math.round(fatihaBytes / 1024)} Ko), ` +
    `Baqara ${baqara.toFixed(1)} ms (${Math.round(baqaraBytes / 1024)} Ko)`,
);
