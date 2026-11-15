/**
 * Bascule Apple TV, utilisée seulement quand EXPO_TV=1.
 * Le package.json versionné garde react-native 0.88 (iPhone). Le profil EAS
 * production-tv réécrit la dépendance avant l’installation.
 *
 * Expo SDK 58 : React Native téléphone 0.88, React Native TV 0.87-stable
 * (table de compatibilité https://docs.expo.dev/versions/v58.0.0/).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const TV_REACT_NATIVE = 'npm:react-native-tvos@0.87-stable';
const native = require('./tv-native.cjs');

/** Voir scripts/tv-native.cjs — une seule liste pour le hook, le Podfile et l’autolinking. */
export const TV_AUTOLINK_EXCLUDE = native.TV_AUTOLINK_EXCLUDE;
export const TV_RN_CORE_FROM_SOURCE = native.TV_RN_CORE_FROM_SOURCE;

export function tvBuildRequested(env = process.env) {
  return env.EXPO_TV === '1';
}

/** Le hook cloud ne réécrit package.json que sur un build EAS du profil TV. */
export function shouldSwapReactNativeOnEas(env = process.env) {
  return env.EXPO_TV === '1' && env.EAS_BUILD === 'true';
}

export function patchPackageForTv(pkg) {
  const next = structuredClone(pkg);
  next.dependencies = { ...next.dependencies, 'react-native': TV_REACT_NATIVE };
  next.expo = { ...(next.expo || {}) };
  next.expo.install = { ...(next.expo.install || {}) };
  next.expo.install.exclude = [...new Set([...(next.expo.install.exclude || []), 'react-native'])];
  next.expo.autolinking = { ...(next.expo.autolinking || {}) };
  next.expo.autolinking.exclude = [...new Set([...(next.expo.autolinking.exclude || []), ...TV_AUTOLINK_EXCLUDE])];
  return next;
}
