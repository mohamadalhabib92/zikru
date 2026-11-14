/**
 * Hook EAS (eas-build-pre-install), y compris « Build from GitHub ».
 * EAS pose EAS_BUILD=true et les variables du profil avant ce script.
 * Sans EXPO_TV=1 (profil production iPhone), on sort tout de suite :
 * react-native reste 0.88, le lockfile n’est pas réécrit.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { patchPackageForTv, shouldSwapReactNativeOnEas } from './tv-build.mjs';

if (!shouldSwapReactNativeOnEas()) {
  console.log(
    `eas-tv-preinstall: no swap (EXPO_TV=${process.env.EXPO_TV ?? ''} EAS_BUILD=${process.env.EAS_BUILD ?? ''}). react-native stays on the phone package`,
  );
  process.exit(0);
}

console.log('eas-tv-preinstall: EXPO_TV=1 on EAS, switching react-native to react-native-tvos before install');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync('package.json', JSON.stringify(patchPackageForTv(pkg), null, 2) + '\n');
const r = spawnSync(
  'npm',
  ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps'],
  { stdio: 'inherit' },
);
process.exit(r.status ?? 1);
