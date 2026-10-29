// Charge des modules TypeScript de src/lib (transpilés à la volée, imports relatifs suivis récursivement).
import ts from 'typescript';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export async function loadLib(names, tag = 'lib') {
  const base = join(root, 'node_modules', '.cache');
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, `zikru-${tag}-`));
  const done = new Set();
  // Résolution des imports relatifs (./x, ../x, ./dossier/x) par rapport à src/lib ; les sous-dossiers sont reproduits.
  const visit = (rel, top = false) => {
    if (done.has(rel)) return;
    done.add(rel);
    const file = join(root, 'src/lib', rel + '.ts');
    if (!existsSync(file)) {
      if (top) throw new Error('module introuvable : ' + rel);
      return; // import de type seul (élidé à la transpilation) ou module hors src/lib
    }
    const src = readFileSync(file, 'utf8');
    const here = posix.dirname(rel);
    const re = /from '(\.\.?\/[\w./-]+)'/g;
    for (const m of src.matchAll(re)) {
      visit(posix.normalize(posix.join(here, m[1])));
    }
    const out = ts.transpileModule(src.replace(re, "from '$1.mjs'"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
    mkdirSync(join(dir, here), { recursive: true });
    writeFileSync(join(dir, rel + '.mjs'), out);
  };
  names.forEach((n) => visit(n, true));
  const mods = {};
  for (const n of names) mods[n] = await import(join(dir, n + '.mjs'));
  return mods;
}
