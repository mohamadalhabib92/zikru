// Garde de démarrage : chaque module natif connu du SDK doit être à la version
// embarquée par le paquet `expo` installé (carte locale, sans réseau).
// Un écart expo-file-system / expo-modules-core a déjà fait planter le lancement
// avec « DYLD Symbol missing » (build 43).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const semver = require('semver');

export function versionMismatch(name, installed, expected) {
  if (!expected || !installed) return true;
  if (name === 'expo') return semver.ltr(installed, expected);
  return !semver.satisfies(installed, expected, { includePrerelease: true });
}

assert.equal(versionMismatch('expo-file-system', '57.0.0', '~58.0.12'), true);
assert.equal(versionMismatch('expo-file-system', '58.0.12', '~58.0.12'), false);
assert.equal(versionMismatch('expo-modules-core', '58.0.0', '~58.0.27'), true);
assert.equal(versionMismatch('expo', '57.0.0', '~58.0.20'), true);
assert.equal(versionMismatch('expo', '58.0.20', '~58.0.20'), false);
assert.equal(versionMismatch('expo', '58.0.99', '~58.0.20'), false);

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const bundled = JSON.parse(readFileSync(require.resolve('expo/bundledNativeModules.json'), 'utf8'));
const declared = { ...pkg.dependencies, ...pkg.devDependencies };
const must = ['expo-file-system', 'expo-modules-core', 'expo-font', 'expo-router'];
const checked = [];
const bad = [];

function installedVersion(name) {
  try {
    return JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

for (const name of Object.keys(declared)) {
  if (!(name in bundled)) continue;
  const installed = installedVersion(name);
  const expected = bundled[name];
  checked.push(name);
  if (versionMismatch(name, installed, expected)) bad.push(`${name} installé ${installed ?? 'absent'} (${declared[name]}), attendu ${expected}`);
}

const coreExpected = bundled['expo-modules-core'];
const coreInstalled = installedVersion('expo-modules-core');
if (!checked.includes('expo-modules-core')) {
  checked.push('expo-modules-core');
  if (versionMismatch('expo-modules-core', coreInstalled, coreExpected)) {
    bad.push(`expo-modules-core installé ${coreInstalled ?? 'absent'}, attendu ${coreExpected}`);
  }
}

assert.equal(typeof installedVersion('expo'), 'string', 'paquet expo absent');
for (const name of must) assert.ok(checked.includes(name), name + ' absent du contrôle');
assert.ok(checked.length >= 10, 'trop peu de paquets contrôlés');
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log(`test-expo-versions OK (${checked.length})`);
