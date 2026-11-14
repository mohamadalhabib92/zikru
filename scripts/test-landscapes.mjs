// Fonds de paysage : fichiers légers, plaque opaque, contraste AA sur les pixels réellement derrière le texte.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { loadLib } from './load-lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { landscapes: L } = await loadLib(['landscapes'], 'landscapes');

const themeSrc = readFileSync(join(root, 'src/ui/theme.ts'), 'utf8').replace(/^import \{ Platform[^\n]*\n/m, "const Platform = { OS: 'ios' };\n");
const themeOut = ts.transpileModule(themeSrc, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const themeFile = join(root, 'node_modules', '.cache', `zikru-theme-land-${process.pid}.mjs`);
const { writeFileSync, mkdirSync } = await import('node:fs');
mkdirSync(join(root, 'node_modules', '.cache'), { recursive: true });
writeFileSync(themeFile, themeOut);
const { palettes, contrast } = await import(themeFile);

assert.equal(L.LANDSCAPE_THEMES_REQUIRE_PREMIUM, false, 'les paysages sont gratuits tant que Mohamed n’a pas tranché');
assert.equal(L.LANDSCAPE_PLATE_ALPHA, 1, 'la plaque de lecture reste opaque : harakât nets, contraste = jetons du thème');
assert.equal(L.sanitizeLandscape(undefined), 'none');
assert.equal(L.sanitizeLandscape('inconnu'), 'none');
assert.equal(L.sanitizeLandscape('lagoon'), 'lagoon');
for (const id of L.LANDSCAPE_IDS) assert.equal(L.sanitizeLandscape(id), id);

const settings = readFileSync(join(root, 'src/lib/settings.tsx'), 'utf8');
assert.match(settings, /landscape: 'none'/);
assert.match(settings, /sanitizeLandscape\(s\.landscape\)/);
const backdrop = readFileSync(join(root, 'src/components/landscape-backdrop.tsx'), 'utf8');
assert.doesNotMatch(backdrop, /Animated|video|<video|blurRadius/);
assert.match(backdrop, /fadeDuration=\{0\}/);
assert.match(backdrop, /if \(id === 'none'\) return null/);
const pwa = readFileSync(join(root, 'scripts/pwa-postbuild.mjs'), 'utf8');
assert.ok(pwa.includes('\\/landscapes\\/[^/]+\\.webp'), 'les paysages ne sont pas pré-chargés au démarrage de la PWA');
const tasbih = readFileSync(join(root, 'src/app/(tabs)/tasbih.tsx'), 'utf8');
assert.match(tasbih, /backgroundColor: t\.surface/);
assert.match(tasbih, /LandscapeBackdrop/);

const MAX = 300 * 1024;
const alpha = L.LANDSCAPE_PLATE_ALPHA;

function decode(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 20_000_000 });
  assert.equal(raw.status, 0, raw.stderr?.toString());
  assert.equal(raw.stdout.length, w * h * 3);
  return { w, h, rgb: raw.stdout };
}

function hex(h) {
  return [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16));
}
function mix(pixel, plate, a) {
  return [
    Math.round(a * plate[0] + (1 - a) * pixel[0]),
    Math.round(a * plate[1] + (1 - a) * pixel[1]),
    Math.round(a * plate[2] + (1 - a) * pixel[2]),
  ];
}
function hexOf(rgb) {
  return '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
}

let bytes = 0;
const lines = [];
for (const id of L.LANDSCAPE_IDS) {
  const file = join(root, 'assets/landscapes', id + '.webp');
  const size = statSync(file).size;
  bytes += size;
  assert.ok(size <= MAX, `${id} pèse ${size} octets (> 300 Ko)`);
  const { w, h, rgb } = decode(file);
  assert.ok(h > w, `${id} doit être un portrait`);
  let varied = false;
  const first = [rgb[0], rgb[1], rgb[2]];
  for (const [scheme, pal] of [['clair', palettes.LIGHT], ['sombre', palettes.DARK]]) {
    const plate = hex(pal.bg);
    const fg = { text: pal.text, muted: pal.muted, accent: pal.accent, primary: pal.primary };
    const worst = { text: 99, muted: 99, accent: 99, primary: 99 };
    const step = 48; // un pixel sur 16, en rgb
    for (let i = 0; i < rgb.length; i += step) {
      const pixel = [rgb[i], rgb[i + 1], rgb[i + 2]];
      if (pixel[0] !== first[0] || pixel[1] !== first[1] || pixel[2] !== first[2]) varied = true;
      const bg = hexOf(mix(pixel, plate, alpha));
      for (const k of Object.keys(worst)) worst[k] = Math.min(worst[k], contrast(fg[k], bg));
    }
    for (const [k, min] of [['text', 4.5], ['muted', 4.5], ['accent', 4.5], ['primary', 4.5]]) {
      assert.ok(worst[k] >= min, `${id} ${scheme} ${k} ${worst[k].toFixed(2)} < ${min}`);
    }
    const onSurface = Math.min(contrast(pal.text, pal.surface), contrast(pal.muted, pal.surface));
    assert.ok(onSurface >= 4.5, `${scheme} compteur sur surface ${onSurface.toFixed(2)}`);
    lines.push(`${id} ${scheme} texte ${worst.text.toFixed(2)} muet ${worst.muted.toFixed(2)} accent ${worst.accent.toFixed(2)} primaire ${worst.primary.toFixed(2)} (${w}×${h}, ${size} o)`);
  }
  assert.ok(varied, `${id} est une image uniforme`);
}
console.log(lines.join('\n'));
console.log(`Paysages : ${L.LANDSCAPE_IDS.length} images, ${bytes} octets au total, plaque α=${alpha}, Premium=${L.LANDSCAPE_THEMES_REQUIRE_PREMIUM}.`);
