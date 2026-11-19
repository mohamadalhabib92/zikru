// Garde de la branche d’intégration TestFlight.
// La version marketing est 1.0.30, strictement au-dessus de 1.0.29,
// pour que TestFlight ne soit pas un retour arrière. Ce n’est pas une
// preuve que les portes de sauvegarde / restauration sont passées.
// package.json reste 1.0.0 : ce n’est pas le numéro affiché dans TestFlight.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const policy = read('src/lib/privacy-policy.ts');
const ui = read('src/lib/ui-strings.ts');
const html = read('public/privacy/index.html');
const store = read('store/ios-metadata.md');
const preserve = read('src/lib/preserve.ts');
const sounds = JSON.stringify(app.expo.plugins ?? app);

assert.equal(app.expo.version, '1.0.30', 'au-dessus de 1.0.29, pas un retour arrière TestFlight');
assert.equal(pkg.version, '1.0.0');
assert.notEqual(pkg.version, app.expo.version, 'package.json n’est pas le numéro TestFlight');
assert.match(store, /1\.0\.0/);
assert.match(preserve, /MARKETING_VERSION = '1\.0\.30'/);
assert.match(policy, /version 1\.0\.30/);
assert.match(policy, /LiveKit/);
assert.match(policy, /chiffrés en transit, pas encore de bout en bout/);
assert.doesNotMatch(policy, /Frankfurt/);
assert.match(ui, /pas encore de chiffrement de bout en bout/);
assert.match(policy, /ne sont pas encore chiffrés de bout en bout/);
assert.match(html, /10 novembre 2026 \(version 1\.0\.30\)/);
assert.match(html, /LiveKit/);
assert.match(html, /pas encore de bout en bout/);
assert.match(sounds, /adhan_cue\.wav/);
console.log('release-guard : 1.0.30, son court embarqué, LiveKit décrit en transit sans bout en bout, région non inventée.');
