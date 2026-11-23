// Garde de la branche d’intégration TestFlight.
// La version marketing est 1.0.30, strictement au-dessus de 1.0.29,
// pour que TestFlight ne soit pas un retour arrière. Ce n’est pas une
// preuve que les portes de sauvegarde / restauration sont passées.
// package.json reste 1.0.0 : ce n’est pas le numéro affiché dans TestFlight.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLib } from './load-lib.mjs';
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

const eas = JSON.parse(read('eas.json'));
assert.equal(eas.build.production.env.EXPO_PUBLIC_STORE_RELEASE, '1');
assert.equal(eas.build['production-tv'].env.EXPO_PUBLIC_STORE_RELEASE, '1');
const gate = read('src/lib/release-content.ts');
for (const id of ['quranenc', 'kfgqpc-text-font', 'tanzil-transliteration', 'ibn-kathir-en', 'kfgqpc-tajwid']) {
  assert.match(gate, new RegExp(`id: '${id}'`));
}
assert.match(read('src/lib/quran-licenses.ts'), /sourceAllowed\('quranenc'/);
assert.match(read('src/lib/quran-offline.ts'), /editionFetchAllowed/);
assert.match(read('src/lib/quran-reader-data.ts'), /tafsirAllowed/);
assert.match(read('src/app/config.tsx'), /storeRelease\(\)/);
assert.match(read('src/app/config.tsx'), /Redirect/);
assert.match(read('src/app/settings.tsx'), /storeRelease\(\)/);
assert.doesNotMatch(read('src/app/settings.tsx'), /' \(exemple\)'/);
assert.match(read('src/app/dhikr.tsx'), /showExampleMarks\(\)/);
const { 'release-content': G } = await loadLib(['release-content'], 'release-guard');
assert.equal(G.storeRelease(undefined), false);
assert.equal(G.storeRelease('1'), true);
assert.equal(G.GATED_LICENCE_SOURCES.length, 5);
assert.equal(G.sourceAllowed('quranenc', true), false);
assert.equal(G.sourceAllowed('quranenc', false), true);
assert.equal(G.editionFetchAllowed('qe:german_bubenheim', true), false);
assert.equal(G.editionFetchAllowed('en.pickthall', true), true);
assert.equal(G.editionFetchAllowed('fr.hamidullah', true), true);
assert.equal(G.editionFetchAllowed('ar.muyassar', true), false);
assert.equal(G.editionFetchAllowed('en.transliteration', true), false);
assert.equal(G.tafsirAllowed('ibnkathir', true), false);
assert.equal(G.tafsirAllowed('muyassar', true), false);
assert.equal(G.tafsirAllowed('jalalayn', true), true);
assert.equal(G.tafsirAllowed('saadi', true), true);
assert.equal(G.fontFamilyAllowed('KFGQPC HAFS', true), false);
assert.equal(G.fontFamilyAllowed('AmiriQuran_400Regular', true), true);
assert.equal(G.examplePlaceMark('example', true), '');
assert.equal(G.examplePlaceMark('example', false), ' (exemple)');

console.log('release-guard : 1.0.30, son court embarqué, LiveKit décrit en transit sans bout en bout, région non inventée, cinq sources masquées en App Store.');
