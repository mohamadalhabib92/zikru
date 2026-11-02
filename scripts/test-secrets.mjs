// Le dépôt ne contient ni URL Supabase réelle, ni clé publishable, ni EXPO_PUBLIC_EXAMPLE_*.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const skip = new Set(['node_modules', '.git', 'dist', '.expo']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|json|example)$/.test(name)) out.push(p);
  }
  return out;
}
const re = /supabase\.co|sb_publishable_|service_role\s*[:=]\s*['"]ey|EXPO_PUBLIC_EXAMPLE_/;
const bad = [];
for (const f of [...walk('src'), '.env.example', 'app.json']) {
  if (re.test(readFileSync(f, 'utf8'))) bad.push(f);
}
assert.deepEqual(bad, []);
console.log('test-secrets OK');
