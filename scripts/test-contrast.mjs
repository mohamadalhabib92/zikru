// Contraste WCAG AA (≥ 4,5:1 texte courant) des jetons du thème, en clair ET en sombre.
// Lit src/ui/theme.ts tel quel (sans React Native) : LIGHT, DARK, BRAND_LIGHT, BRAND_DARK.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/ui/theme.ts', import.meta.url), 'utf8');
const block = (name) => {
  const m = src.match(new RegExp(`const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\};`));
  assert.ok(m, `bloc ${name} introuvable`);
  return m[1];
};
const parse = (name, env) => {
  const body = block(name);
  const out = {};
  const spread = body.match(/\.\.\.(\w+)/);
  if (spread) Object.assign(out, env[spread[1]]);
  for (const [, k, v] of body.matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)) out[k] = v;
  for (const [, k, o, f] of body.matchAll(/(\w+): (\w+)\.(\w+),/g)) out[k] = env[o][f];
  return out;
};
const env = {};
env.LIGHT = parse('LIGHT', env);
env.DARK = { ...env.LIGHT, ...parse('DARK', env) };
env.BRAND_LIGHT = parse('BRAND_LIGHT', env);
env.BRAND_DARK = parse('BRAND_DARK', env);

const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const THEME_PAIRS = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surfaceAlt'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surfaceAlt'],
  ['onPrimary', 'primary'], ['primary', 'surface'],
  ['danger', 'dangerBg'], ['danger', 'surface'],
  ['success', 'successBg'], ['warning', 'warningBg'], ['info', 'infoBg'],
  ['surface', 'text'], // toasts inversés
];
const BRAND_PAIRS = [
  ['ink', 'paper'], ['ink', 'cream'], ['inkMuted', 'paper'], ['inkMuted', 'cream'],
  ['onGreen', 'green'], ['green', 'paper'],
  ['heroText', 'hero'], ['heroMuted', 'hero'], ['gold', 'hero'],
  ['goldDeep', 'paper'], ['goldDeep', 'cream'], ['wirdGreen', 'paper'],
];

let n = 0;
const fails = [];
for (const [label, t, b, pairs] of [
  ['clair', env.LIGHT, env.BRAND_LIGHT, null],
  ['sombre', env.DARK, env.BRAND_DARK, null],
]) {
  for (const [fg, bg] of THEME_PAIRS) {
    const r = ratio(t[fg], t[bg]); n++;
    if (r < 4.5) fails.push(`${label} theme.${fg} sur ${bg} = ${r.toFixed(2)}`);
  }
  for (const [fg, bg] of BRAND_PAIRS) {
    const r = ratio(b[fg], b[bg]); n++;
    if (r < 4.5) fails.push(`${label} brand.${fg} sur ${bg} = ${r.toFixed(2)}`);
  }
}
assert.deepEqual(fails, [], `Contraste AA insuffisant :\n${fails.join('\n')}`);
console.log(`contrast: ${n} paires AA (clair + sombre) ✓`);
