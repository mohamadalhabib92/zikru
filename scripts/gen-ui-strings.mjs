// Génère les catalogues d'interface depuis i18n/*.tsv (colonnes : fr \t en \t ar) et i18n/de/*.tsv (fr \t de).
// Usage : node scripts/gen-ui-strings.mjs   (relancer après toute modification d'un .tsv)
//
// Sorties (passe 6 — un fichier par langue, chargé à la demande : un utilisateur francophone ne télécharge aucun catalogue) :
//  - src/lib/ui-cat/en.ts, ar.ts, de.ts : catalogue principal { texte français exact → traduction } ;
//  - src/lib/ui-strings-<module>.ts : catalogues « @lazy <module> » [en, ar, de] chargés avec leur module.
// L'allemand (de, et de-CH dérivé : ß → ss) est une traduction NON RELUE : signalée comme telle dans l'app (LANGS.review).
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../i18n/', import.meta.url).pathname;
const deDir = join(dir, 'de');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const vars = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
const out = new Map();
// Fichiers dont la 1re ligne est « # @lazy <module> » : catalogue séparé, chargé avec le module (hors chargement initial).
const lazy = new Map();
const errs = [];
const warns = [];
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
    const vf = vars(fr);
    if (vf !== vars(en) || vf !== vars(ar)) errs.push(`${f}:${i + 1} : variables {…} différentes`);
    dest.set(fr, [en, ar, '']);
  });
}
// Allemand : i18n/de/*.tsv (fr \t de). Clé inconnue = avertissement (chaîne retirée de l'interface).
const DE = new Map();
if (existsSync(deDir)) {
  for (const f of readdirSync(deDir).filter((x) => x.endsWith('.tsv')).sort()) {
    readFileSync(join(deDir, f), 'utf8').split('\n').forEach((line, i) => {
      if (!line.trim() || line.startsWith('#')) return;
      const p = line.split('\t');
      if (p.length !== 2 || !p[0].trim() || !p[1].trim()) return errs.push(`de/${f}:${i + 1} : 2 colonnes non vides attendues (fr, de)`);
      const [fr, de] = p.map((x) => norm(x.replace(/\\n/g, '\n')));
      if (vars(fr) !== vars(de)) errs.push(`de/${f}:${i + 1} : variables {…} différentes`);
      DE.set(fr, de);
    });
  }
}
if (errs.length) {
  console.error(errs.join('\n'));
  process.exit(1);
}
const all = new Set([...out.keys(), ...[...lazy.values()].flatMap((m) => [...m.keys()])]);
for (const k of DE.keys()) if (!all.has(k)) warns.push('de : clé inconnue « ' + k.slice(0, 60) + ' »');
const sorted = (m) => [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
mkdirSync(new URL('../src/lib/ui-cat/', import.meta.url), { recursive: true });
let deMain = 0;
for (const [li, lang] of ['en', 'ar', 'de'].entries()) {
  const rows = sorted(out)
    .map(([k, v]) => [k, li === 2 ? DE.get(k) : v[li]])
    .filter(([, v]) => v);
  if (lang === 'de') deMain = rows.length;
  writeFileSync(
    new URL(`../src/lib/ui-cat/${lang}.ts`, import.meta.url),
    `// GÉNÉRÉ par scripts/gen-ui-strings.mjs depuis i18n/${lang === 'de' ? 'de/' : ''}*.tsv — ne pas modifier à la main.\n` +
      `// Catalogue principal « ${lang} » (clé : texte français exact), chargé à la demande selon la langue choisie.\n` +
      (lang === 'de' ? '// Traduction allemande NON RELUE par un humain : à faire relire avant toute mention « relu ».\n' : '') +
      `export const CAT: Record<string, string> = {\n${rows.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}\n};\n`,
  );
}
let deLazy = 0, lazyTot = 0;
for (const [mod, m] of lazy) {
  for (const k of m.keys()) if (out.has(k)) m.delete(k);
  for (const [k, v] of m) {
    v[2] = DE.get(k) ?? '';
    lazyTot++;
    if (v[2]) deLazy++;
  }
  const id = 'UI_STRINGS_' + mod.toUpperCase().replace(/-/g, '_');
  writeFileSync(
    new URL(`../src/lib/ui-strings-${mod}.ts`, import.meta.url),
    `// GÉNÉRÉ par scripts/gen-ui-strings.mjs depuis i18n/*.tsv (« @lazy ${mod} ») — ne pas modifier à la main.\n// Catalogue chargé avec le module ${mod} (registerUiStrings), hors chargement initial. de = allemand non relu ('' = repli français).\nexport const ${id}: Record<string, [en: string, ar: string, de: string]> = {\n${sorted(m).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}\n};\n`,
  );
  console.log(`ui-strings-${mod} : ${m.size} entrées (à la demande)`);
}
if (warns.length) console.warn(warns.slice(0, 20).join('\n') + (warns.length > 20 ? `\n… ${warns.length - 20} de plus` : ''));
console.log(`ui-cat : ${out.size} entrées (en, ar) · allemand ${deMain + deLazy}/${out.size + lazyTot} (non relu)`);
