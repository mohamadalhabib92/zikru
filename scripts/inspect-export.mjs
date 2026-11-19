// Lit un export JSON et dit s'il est applicable. N'écrit rien, n'importe rien, ne contacte aucun serveur.
// Usage : node scripts/inspect-export.mjs fichier.json
//         node scripts/inspect-export.mjs --self-test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLib } from './load-lib.mjs';

const { preserve } = await loadLib(['preserve'], 'inspect-export');

function unwrap(doc) {
  if (doc && typeof doc === 'object' && doc.data && doc.data.format === 'zikru-local-export') return doc.data;
  return doc;
}

export function inspect(doc) {
  const inner = unwrap(doc);
  const a = preserve.assessLocalExport(inner);
  return {
    applicable: a.applicable,
    reason: a.reason,
    futureFormat: a.futureFormat,
    deviceBackup: inner && typeof inner === 'object' ? inner.deviceBackup === true : false,
    keys: a.keys.length,
    restore: 'non exécutée — aucun import automatique',
  };
}

if (process.argv[2] === '--self-test') {
  const ok = inspect({
    format: 'zikru-local-export',
    formatVersion: 1,
    appMarketingVersion: '1.0.29',
    deviceBackup: false,
    entries: [{ key: 'tasbih', raw: '{"version":2,"extra":1}' }],
  });
  assert.equal(ok.applicable, true);
  assert.equal(ok.deviceBackup, false);
  assert.equal(ok.keys, 1);
  const wrapped = inspect({ app: 'Zikru', format: 1, data: { format: 'zikru-local-export', formatVersion: 1, deviceBackup: false, entries: [] } });
  assert.equal(wrapped.applicable, true);
  const future = inspect({ format: 'zikru-local-export', formatVersion: 2, entries: [{ key: 'a', raw: '1' }] });
  assert.equal(future.applicable, false);
  assert.equal(future.futureFormat, true);
  console.log('inspect-export : lecture seule, fixtures synthétiques, aucune restauration.');
} else if (process.argv[2]) {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const out = inspect(doc);
  console.log(JSON.stringify(out, null, 2));
  if (!out.applicable) process.exitCode = 2;
} else {
  console.error('Usage : node scripts/inspect-export.mjs <fichier.json|--self-test>');
  process.exitCode = 1;
}
