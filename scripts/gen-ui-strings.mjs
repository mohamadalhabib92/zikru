// Génère src/lib/ui-strings.ts depuis i18n/*.tsv (colonnes : fr \t en \t ar).
// Usage : node scripts/gen-ui-strings.mjs   (relancer après toute modification d'un .tsv)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../i18n/', import.meta.url).pathname;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const out = new Map();
// Fichiers dont la 1re ligne est « # @lazy <module> » : catalogue séparé, chargé avec le module (hors chargement initial).
const lazy = new Map();
const errs = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsv')).sort()) {
  const txt = readFileSync(join(dir, f), 'utf8');
  const lz = txt.match(/^# @lazy ([\w-]+)/)?.[1];
  const dest = lz ? (lazy.get(lz) ?? lazy.set(lz, new Map()).get(lz)) : out;
  txt.split('\n').forEach((line, i) => {
    if (!line.trim() || line.startsWith('#')) return;
    const p = line.split('\t');
    if (p.length !== 3 || !p[0].trim() || !p[1].trim() || !p[2].trim()) return errs.push(`${f}:${i + 1} : 3 colonnes non vides attendues`);
    const [fr, en, ar] = p.map((x) => norm(x.replace(/\\n/g, '\n')));
    if (!/[\u0600-\u06FF]/.test(ar)) errs.push(`${f}:${i + 1} : arabe sans écriture arabe`);
    const vf = (fr.match(/\{\w+\}/g) ?? []).sort().join();
    if (vf !== (en.match(/\{\w+\}/g) ?? []).sort().join() || vf !== (ar.match(/\{\w+\}/g) ?? []).sort().join()) errs.push(`${f}:${i + 1} : variables {…} différentes`);
    dest.set(fr, [en, ar]);
  });
}
if (errs.length) {
  console.error(errs.join('\n'));
  process.exit(1);
}
const entries = (m) => [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
for (const [mod, m] of lazy) {
  for (const k of m.keys()) if (out.has(k)) m.delete(k);
  const id = 'UI_STRINGS_' + mod.toUpperCase().replace(/-/g, '_');
  writeFileSync(
    new URL(`../src/lib/ui-strings-${mod}.ts`, import.meta.url),
    `// GÉNÉRÉ par scripts/gen-ui-strings.mjs depuis i18n/*.tsv (« @lazy ${mod} ») — ne pas modifier à la main.\n// Catalogue chargé avec le module ${mod} (registerUiStrings), hors chargement initial.\nexport const ${id}: Record<string, [en: string, ar: string]> = {\n${entries(m)}\n};\n`,
  );
  console.log(`ui-strings-${mod} : ${m.size} entrées (à la demande)`);
}
const body = [...out.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
writeFileSync(
  new URL('../src/lib/ui-strings.ts', import.meta.url),
  `// GÉNÉRÉ par scripts/gen-ui-strings.mjs depuis i18n/*.tsv — ne pas modifier à la main.\n// Clé : texte français exact de l'interface ; valeur : [anglais, arabe standard moderne].\nexport const UI_STRINGS: Record<string, [en: string, ar: string]> = {\n${body}\n};\n`,
);
console.log(`ui-strings : ${out.size} entrées`);
