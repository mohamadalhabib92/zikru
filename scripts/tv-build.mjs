/**
 * Bascule Apple TV, utilisée seulement quand EXPO_TV=1.
 * Le package.json versionné garde react-native 0.88 (iPhone). Le profil EAS
 * production-tv réécrit la dépendance avant l’installation.
 *
 * Expo SDK 58 : React Native téléphone 0.88, React Native TV 0.87-stable
 * (table de compatibilité https://docs.expo.dev/versions/v58.0.0/).
 */
export const TV_REACT_NATIVE = 'npm:react-native-tvos@0.87-stable';

/** Modules dont le podspec est iOS seulement, ou qui n’ont pas de sens sur le téléviseur. */
export const TV_AUTOLINK_EXCLUDE = [
  'react-native-ble-plx',
  'expo-location',
  'expo-notifications',
  'expo-haptics',
  'expo-image-picker',
  'expo-clipboard',
  'expo-speech',
  'expo-document-picker',
  'expo-widgets',
  '@livekit/react-native',
  '@livekit/react-native-webrtc',
  '@expo/dom-webview',
  '@bacons/apple-targets',
  'zikru-ocr',
  'zikru-watch',
  'zikru-quick-actions',
];

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
