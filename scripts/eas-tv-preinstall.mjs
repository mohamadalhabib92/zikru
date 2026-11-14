/**
 * Hook EAS (eas-build-pre-install). Sans EXPO_TV=1, ne touche à rien :
 * le profil production iPhone installe react-native 0.88 tel que versionné.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { patchPackageForTv, tvBuildRequested } from './tv-build.mjs';

if (!tvBuildRequested()) {
  console.log('eas-tv-preinstall: EXPO_TV is not 1, react-native stays on the phone package');
  process.exit(0);
}
if (process.env.EAS_BUILD !== 'true') {
  console.log('eas-tv-preinstall: not an EAS build, package.json left unchanged');
  process.exit(0);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync('package.json', JSON.stringify(patchPackageForTv(pkg), null, 2) + '\n');
const r = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
