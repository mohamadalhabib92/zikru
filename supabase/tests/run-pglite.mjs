// Tests hors-ligne des migrations Supabase (RLS, fonctions, déclencheurs) dans PGlite (Postgres WebAssembly).
// Chaque suite part d'une base neuve : simulacre Supabase → toutes les migrations de supabase/migrations → suite.
// Usage : npm run test:sql   (aucun accès réseau, aucune base réelle)
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const migDir = join(root, 'supabase/migrations');
const migrations = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort().map((f) => join(migDir, f));
const suites = readdirSync(here).filter((f) => f.endsWith('_test.sql')).sort().map((f) => join(here, f));
for (const suite of suites) {
  const db = new PGlite({ extensions: { pgcrypto } });
  for (const f of [join(here, '00_supabase_stubs.sql'), ...migrations, suite]) {
    try {
      await db.exec(readFileSync(f, 'utf8'));
    } catch (e) {
      console.error('ÉCHEC', f.replace(root + '/', ''), '\n', e.message, e.where ? `\n${e.where}` : '');
      process.exit(1);
    }
  }
  console.log('ok  ', suite.replace(root + '/', ''));
  await db.close();
}
console.log(`test-sql OK : ${migrations.length} migrations, ${suites.length} suite(s)`);
