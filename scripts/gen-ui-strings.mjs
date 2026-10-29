// Génère src/lib/ui-strings.ts depuis i18n/*.tsv (colonnes : fr \t en \t ar).
// Usage : node scripts/gen-ui-strings.mjs   (relancer après toute modification d'un .tsv)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../i18n/', import.meta.url).pathname;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const out = new Map();
const errs = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsv')).sort()) {
  readFileSync(join(dir, f), 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim() || line.startsWith('#')) return;
    const p = line.split('\t');
    if (p.length !== 3 || !p[0].trim() || !p[1].trim() || !p[2].trim()) return errs.push(`${f}:${i + 1} : 3 colonnes non vides attendues`);
    const [fr, en, ar] = p.map((x) => norm(x.replace(/\\n/g, '\n')));
    if (!/[\u0600-\u06FF]/.test(ar)) errs.push(`${f}:${i + 1} : arabe sans écriture arabe`);
    const vf = (fr.match(/\{\w+\}/g) ?? []).sort().join();
    if (vf !== (en.match(/\{\w+\}/g) ?? []).sort().join() || vf !== (ar.match(/\{\w+\}/g) ?? []).sort().join()) errs.push(`${f}:${i + 1} : variables {…} différentes`);
    out.set(fr, [en, ar]);
  });
}
if (errs.length) {
  console.error(errs.join('\n'));
  process.exit(1);
}
const body = [...out.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
writeFileSync(
  new URL('../src/lib/ui-strings.ts', import.meta.url),
  `// GÉNÉRÉ par scripts/gen-ui-strings.mjs depuis i18n/*.tsv — ne pas modifier à la main.\n// Clé : texte français exact de l'interface ; valeur : [anglais, arabe standard moderne].\nexport const UI_STRINGS: Record<string, [en: string, ar: string]> = {\n${body}\n};\n`,
);
console.log(`ui-strings : ${out.size} entrées`);
