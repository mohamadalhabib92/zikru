// Exécute les migrations Supabase existantes + P1a (droits) + P1 (groupes) puis chaque fichier de tests,
// chacun dans une base PGlite neuve (Postgres en mémoire, WebAssembly). Aucun accès réseau, aucune base réelle.
// Usage (depuis un dossier temporaire où @electric-sql/pglite est installé) :
//   ZIKRU=/chemin/vers/zikru node run-pglite.mjs
// Variables facultatives : P1_DIR (docs/p1-groups/sql), ENT_DIR (docs/entitlements/sql).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.ZIKRU ?? join(here, '../../../..');
const p1 = process.env.P1_DIR ?? join(here, '..');
const ent = process.env.ENT_DIR ?? join(root, 'docs/entitlements/sql');
const stubs = join(p1, 'tests', '00_supabase_stubs.sql');
const migDir = join(root, 'supabase/migrations');
const sqlIn = (d) => readdirSync(d).filter((f) => f.endsWith('.sql')).map((f) => join(d, f));
const byName = (a, b) => a.split('/').pop().localeCompare(b.split('/').pop());
// Ordre par horodatage : 20261029110000 (P1a) avant 20261029120000 (P1).
const migrations = [...sqlIn(migDir), ...sqlIn(ent), ...sqlIn(p1)].sort(byName);
const suites = [join(p1, 'tests', 'p1_groupes_test.sql'), join(ent, 'tests', 'p1a_droits_test.sql')];
for (const suite of suites) {
  const db = new PGlite({ extensions: { pgcrypto } });
  for (const f of [stubs, ...migrations, suite]) {
    try {
      await db.exec(readFileSync(f, 'utf8'));
      if (f === suite) console.log('ok  ', f.replace(root + '/', ''));
    } catch (e) {
      console.error('ÉCHEC', f.replace(root + '/', ''), '\n', e.message);
      process.exit(1);
    }
  }
  await db.close();
}
console.log(`migrations appliquées : ${migrations.length} ; suites réussies : ${suites.length}`);
