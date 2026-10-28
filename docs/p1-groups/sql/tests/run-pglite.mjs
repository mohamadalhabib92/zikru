// Exécute les migrations Supabase existantes + la migration P1 + les tests dans un Postgres
// en mémoire (PGlite, WebAssembly). Aucun accès réseau, aucune base réelle touchée.
// Usage (depuis un dossier temporaire où @electric-sql/pglite est installé) :
//   ZIKRU=/chemin/vers/zikru P1_DIR=$ZIKRU/docs/p1-groups/sql node run-pglite.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.ZIKRU ?? join(here, '../../../..');
const p1 = process.env.P1_DIR ?? join(here, '..');
const tests = join(p1, 'tests');
const migDir = join(root, 'supabase/migrations');
const files = [
  join(tests, '00_supabase_stubs.sql'),
  ...readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort().map((f) => join(migDir, f)),
  ...readdirSync(p1).filter((f) => f.endsWith('.sql')).sort().map((f) => join(p1, f)),
  join(tests, 'p1_groupes_test.sql'),
];
const db = new PGlite({ extensions: { pgcrypto } });
for (const f of files) {
  try {
    await db.exec(readFileSync(f, 'utf8'));
    console.log('ok  ', f.replace(root + '/', ''));
  } catch (e) {
    console.error('ÉCHEC', f.replace(root + '/', ''), '\n', e.message);
    process.exit(1);
  }
}
