/**
 * Hooks EAS (eas-build-pre-install et eas-build-post-install).
 * EAS pose EAS_BUILD=true et les variables du profil avant ces scripts.
 * Sans EXPO_TV=1 (profil production iPhone), on sort tout de suite :
 * react-native reste 0.88, le lockfile n’est pas réécrit.
 *
 * --check-installed (post-install) lit node_modules après le `npm ci` d’EAS.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { lockedReactNative, omitReactNativeFromLock, patchPackageForTv, shouldSwapReactNativeOnEas } from './tv-build.mjs';

const { patchTvNativeSources } = createRequire(import.meta.url)('./tv-native-patch.cjs');

const checkInstalled = process.argv.includes('--check-installed');

if (!shouldSwapReactNativeOnEas()) {
  console.log(
    `eas-tv-preinstall: no swap (EXPO_TV=${process.env.EXPO_TV ?? ''} EAS_BUILD=${process.env.EAS_BUILD ?? ''}). react-native stays on the phone package`,
  );
  process.exit(0);
}

if (checkInstalled) {
  const installed = JSON.parse(readFileSync('node_modules/react-native/package.json', 'utf8'));
  const version = String(installed.version ?? '');
  const name = String(installed.name ?? '');
  if (!name.includes('tvos') || !version.startsWith('0.87')) {
    console.error(`eas-tv-preinstall: installed react-native is ${name}@${version}, expected react-native-tvos 0.87.x`);
    process.exit(1);
  }
  if (process.env.RCT_USE_PREBUILT_RNCORE !== '0') {
    console.error('eas-tv-preinstall: RCT_USE_PREBUILT_RNCORE must be 0 so CocoaPods builds react-native-tvos from source');
    process.exit(1);
  }
  console.log(
    `eas-tv-preinstall: installed ${name}@${version}; RCT_USE_PREBUILT_RNCORE=0 (rncore.rb only downloads the Maven tarball when that value is 1)`,
  );
  const native = patchTvNativeSources(process.cwd());
  for (const file of native.patched) console.log(`eas-tv-preinstall: patched ${file}`);
  if (native.remaining.length) {
    for (const hit of native.remaining) console.error(`eas-tv-preinstall: tvOS still compiles ${hit}`);
    process.exit(1);
  }
  console.log('eas-tv-preinstall: tvOS native scan found no unguarded iOS-only APIs in linked modules');
  process.exit(0);
}

console.log('eas-tv-preinstall: EXPO_TV=1 on EAS, switching react-native to react-native-tvos before install');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const patched = patchPackageForTv(pkg);
writeFileSync('package.json', JSON.stringify(patched, null, 2) + '\n');

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const before = lockedReactNative(lock);
console.log(`eas-tv-preinstall: lock had react-native ${before.version} (${before.resolved}); dropping it so npm re-resolves the alias`);
writeFileSync('package-lock.json', JSON.stringify(omitReactNativeFromLock(lock), null, 2) + '\n');

const r = spawnSync(
  'npm',
  ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps'],
  { stdio: 'inherit' },
);
if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);

const refreshedPkg = JSON.parse(readFileSync('package.json', 'utf8'));
const refreshed = lockedReactNative(JSON.parse(readFileSync('package-lock.json', 'utf8')));
const specifier = refreshedPkg.dependencies?.['react-native'];
if (specifier !== refreshed.specifier) {
  console.error(`eas-tv-preinstall: package.json react-native is ${specifier} but the lock specifier is ${refreshed.specifier}`);
  process.exit(1);
}
if (!refreshed.resolved.includes('react-native-tvos') || !refreshed.version.startsWith('0.87')) {
  console.error(`eas-tv-preinstall: lockfile react-native is ${refreshed.version} (${refreshed.resolved}), expected react-native-tvos 0.87.x`);
  process.exit(1);
}
console.log(`eas-tv-preinstall: lockfile react-native is ${refreshed.version} from ${refreshed.resolved} (${refreshed.specifier})`);
process.exit(0);
