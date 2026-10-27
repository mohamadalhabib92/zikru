// Tests du module Hijri (sans dépendance de test) : transpile src/lib/hijri.ts puis exécute les auto-tests.
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const src = readFileSync(new URL('../src/lib/hijri.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const f = join(mkdtempSync(join(tmpdir(), 'hijri-')), 'hijri.mjs');
writeFileSync(f, js);
const m = await import(f);
const res = m.runHijriSelfTests();
for (const r of res) console.log(r.ok ? '✓' : '✗', r.name);
const today = new Date();
console.log('Aujourd’hui :', m.formatHijri(today, 'fr'), '|', m.formatHijri(today, 'ar'));
if (res.some((r) => !r.ok)) process.exit(1);
