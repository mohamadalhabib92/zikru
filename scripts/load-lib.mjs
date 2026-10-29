// Charge des modules TypeScript de src/lib (transpilés à la volée, imports relatifs suivis récursivement).
import ts from 'typescript';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export async function loadLib(names, tag = 'lib') {
  const base = join(root, 'node_modules', '.cache');
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, `zikru-${tag}-`));
  const done = new Set();
  const visit = (rel) => {
    if (done.has(rel)) return;
    done.add(rel);
    const file = join(root, 'src/lib', rel + '.ts');
    if (!existsSync(file)) throw new Error('module introuvable : ' + rel);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/from '\.\/([\w.-]+)'/g)) visit(m[1]);
    const out = ts.transpileModule(src.replace(/from '\.\/([\w.-]+)'/g, "from './$1.mjs'"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
    writeFileSync(join(dir, rel + '.mjs'), out);
  };
  names.forEach(visit);
  const mods = {};
  for (const n of names) mods[n] = await import(join(dir, n + '.mjs'));
  return mods;
}
