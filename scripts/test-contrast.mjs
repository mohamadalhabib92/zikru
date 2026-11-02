// Contrastes de l'or : le décoratif #D9B65C échoue sur fond clair, l'encre #7A5E14 passe AA.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLib } from './load-lib.mjs';

const { contrast: C } = await loadLib(['contrast']);
const pairs = [
  [C.GOLD_INK_LIGHT, '#F7F4EE', 4.5],
  [C.GOLD_INK_LIGHT, '#FFFFFF', 4.5],
  [C.GOLD_INK_LIGHT, '#F0ECE3', 4.5],
  [C.GOLD_INK_LIGHT, '#FBF3DC', 4.5],
  [C.GOLD_INK_LIGHT, '#E6F2EC', 4.5],
  [C.GOLD_INK_DARK, '#0A1210', 4.5],
  [C.GOLD_INK_DARK, '#121D19', 4.5],
  [C.GOLD_INK_DARK, '#1A2823', 4.5],
  [C.GOLD_INK_DARK, '#0F3D30', 4.5],
  [C.GOLD_DECOR, '#0F3D30', 4.5],
  ['#13261F', C.GOLD_DECOR, 4.5],
  ['#1B1405', C.GOLD_DECOR, 4.5],
];
for (const [fg, bg, min] of pairs) {
  const r = C.contrastRatio(fg, bg);
  assert.ok(r >= min, `${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);
}
const decorOnCream = C.contrastRatio(C.GOLD_DECOR, '#F7F4EE');
assert.ok(decorOnCream < 3, 'l’or décoratif ne doit pas devenir lisible par accident sur fond clair : ' + decorOnCream);
assert.equal(C.inkOn(C.GOLD_DECOR), C.INK_ON_GOLD);
assert.equal(C.inkOn('#0E6B4F'), '#FFFFFF');

const theme = readFileSync(new URL('../src/ui/theme.ts', import.meta.url), 'utf8');
assert.match(theme, /accent: GOLD_INK_LIGHT/);
assert.match(theme, /accent: GOLD_INK_DARK/);
assert.match(theme, /goldDeep: GOLD_INK_LIGHT/);
assert.match(theme, /goldDeep: GOLD_INK_DARK/);
assert.match(theme, /gold: GOLD_DECOR/);
console.log('test-contrast OK', decorOnCream.toFixed(2), 'or décoratif / crème');
