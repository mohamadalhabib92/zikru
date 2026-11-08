// Contraste WCAG AA mesuré sur les jetons réels de src/ui/theme.ts (clair ET sombre).
// Texte normal ≥ 4,5:1 ; éléments graphiques/icônes ≥ 3:1. `node scripts/test-contrast.mjs --table` imprime le tableau.
import ts from 'typescript';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = readFileSync(join(root, 'src/ui/theme.ts'), 'utf8').replace(/^import \{ Platform[^\n]*\n/m, "const Platform = { OS: 'ios' };\n");
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const dir = join(root, 'node_modules', '.cache');
mkdirSync(dir, { recursive: true });
const file = join(dir, `zikru-theme-${process.pid}.mjs`);
writeFileSync(file, out);
const { palettes, contrast, onColor, identity } = await import(file);
const { LIGHT, DARK, BRAND_LIGHT, BRAND_DARK } = palettes;

const rows = [];
const check = (scheme, fg, bg, fgName, bgName, min) => rows.push({ scheme, pair: `${fgName} / ${bgName}`, fg, bg, ratio: contrast(fg, bg), min });
for (const [scheme, t, b] of [['clair', LIGHT, BRAND_LIGHT], ['sombre', DARK, BRAND_DARK]]) {
  // Texte courant (theme)
  for (const fg of ['text', 'muted', 'primary', 'accent', 'danger', 'success', 'warning', 'info'])
    for (const bg of ['bg', 'surface', 'surfaceAlt']) check(scheme, t[fg], t[bg], `theme.${fg}`, `theme.${bg}`, 4.5);
  for (const k of ['danger', 'success', 'warning', 'info']) check(scheme, t[k], t[k + 'Bg'], `theme.${k}`, `theme.${k}Bg`, 4.5);
  check(scheme, t.onPrimary, t.primary, 'theme.onPrimary', 'theme.primary', 4.5);
  // Texte (brand) sur cartes claires
  for (const fg of ['ink', 'inkMuted', 'goldDeep', 'green', 'brownSoft', 'rust', 'purple', 'brown'])
    for (const bg of ['cream', 'paper']) check(scheme, b[fg], b[bg], `brand.${fg}`, `brand.${bg}`, 4.5);
  check(scheme, b.goldDeep, b.goldSoft, 'brand.goldDeep', 'brand.goldSoft', 4.5);
  check(scheme, b.green, b.greenTint, 'brand.green', 'brand.greenTint', 4.5);
  // Texte sur en-têtes sombres (hero / greenDeep)
  for (const fg of ['heroText', 'heroMuted', 'gold']) for (const bg of ['hero', 'greenDeep']) check(scheme, b[fg], b[bg], `brand.${fg}`, `brand.${bg}`, 4.5);
  // Texte posé sur un remplissage
  check(scheme, b.onGreen, b.green, 'brand.onGreen', 'brand.green', 4.5);
  for (const fill of ['green', 'goldDeep', 'blue', 'violet', 'rust', 'purple']) check(scheme, onColor(b[fill]), b[fill], `onColor(${fill})`, `brand.${fill} (Pill active)`, 4.5);
  // Icônes de tuiles (graphique ≥ 3:1)
  for (const fg of ['teal', 'blue', 'violet', 'indigo', 'wirdGreen', 'goldDeep', 'rust', 'purple']) check(scheme, b[fg], b.paper, `brand.${fg} (icône)`, 'brand.paper', 3);
}
const fails = rows.filter((r) => r.ratio < r.min);
if (process.argv.includes('--table')) {
  console.log('| Schéma | Couple texte / fond | Couleurs | Rapport | Seuil | |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.scheme} | ${r.pair} | ${r.fg} / ${r.bg} | ${r.ratio.toFixed(2)}:1 | ${r.min} | ${r.ratio >= r.min ? 'OK' : 'ÉCHEC'} |`);
}
// Rappels documentés (non bloquants) : l’or d’identité sur fond clair n’est PAS du texte.
const goldLight = contrast(identity.gold, BRAND_LIGHT.cream);
if (BRAND_LIGHT.gold !== identity.gold) fails.push({ pair: 'brand.gold ≠ identité #D9B65C', ratio: 0, min: 0 });
if (LIGHT.primary !== identity.primaryLight || DARK.primary !== identity.primaryDark || BRAND_LIGHT.hero !== identity.splash) fails.push({ pair: 'jetons ≠ identité', ratio: 0, min: 0 });
if (BRAND_LIGHT.ink !== LIGHT.text || BRAND_DARK.ink !== DARK.text || BRAND_LIGHT.cream !== LIGHT.bg || BRAND_DARK.paper !== DARK.surface) fails.push({ pair: 'theme ≠ brand', ratio: 0, min: 0 });
if (fails.length) {
  for (const f of fails) console.error('✗', f.scheme ?? '', f.pair, f.fg ?? '', f.bg ?? '', f.ratio.toFixed(2), '<', f.min);
  process.exit(1);
}
console.log(`Contraste AA : ${rows.length} couples mesurés, tous conformes (or d’identité sur crème = ${goldLight.toFixed(2)}:1 → réservé aux bordures/icônes décoratives).`);
