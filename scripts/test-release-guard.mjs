// Garde de version : la réconciliation 1.0.29 n'est pas faite.
// Ce script ne compte pas des cas unitaires au sens d'une bibliothèque de test :
// une séquence d'asserts sur les fichiers du dépôt.
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

assert.equal(app.expo.version, '1.0.26', 'version marketing de main, pas une réconciliation');
assert.equal(pkg.version, '1.0.0');
assert.notEqual(pkg.version, app.expo.version, 'écart package.json / app.json encore ouvert');
assert.match(store, /1\.0\.0/);
assert.match(preserve, /MARKETING_VERSION = '1\.0\.26'/);
assert.match(policy, /version 1\.0\.24/);
assert.doesNotMatch(policy, /version 1\.0\.29/);
assert.match(ui, /pas encore de chiffrement de bout en bout/);
assert.match(policy, /ne sont pas encore chiffrés de bout en bout/);
assert.equal(html.includes('version 1.0.29'), false, 'la page publique ne doit pas annoncer 1.0.29');
assert.equal(/livekit/i.test(html), false, 'cette branche n’appelle pas LiveKit');
assert.equal(/livekit/i.test(policy), false, 'la politique in-app ne décrit pas LiveKit');
assert.match(html, /30 octobre 2026 \(version 1\.0\.24\)/);
console.log('page publique générée depuis privacy-policy.ts (1.0.24, sans LiveKit). Branche 1.0.29 non fusionnée.');
console.log('release-guard : version marketing 1.0.26 tenue, écarts de source encore nommés.');
