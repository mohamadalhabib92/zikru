// baseUrl n'est utile que pour la PWA (GitHub Pages). Sur les builds natifs EAS,
// il préfixe les assets par "<slug>/", ce qui entre en collision avec
// l'exécutable de même nom (système de fichiers insensible à la casse).
//
// Widgets (Passe 2) : extension WidgetKit iOS + widgets Android via expo-widgets.
// Interrupteur : ZIKRU_NO_WIDGETS=1 retire entièrement l'extension du projet natif
// (l'app fonctionne alors sans widgets ; le pont JS devient sans effet).
// Siri (App Intents, dossier app-intents/) : ZIKRU_NO_SIRI=1 retire le plugin et le module inline.
const WIDGETS = [
  {
    name: 'NextPrayer',
    displayName: 'Prochaine prière',
    description: 'L’heure de la prochaine prière et le temps restant, calculés sur l’appareil.',
    ios: { supportedFamilies: ['systemSmall', 'systemMedium', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'], initialLayout: 'widgets/ios/NextPrayer.tsx' },
    android: { targetCellWidth: 2, targetCellHeight: 2, initialLayout: 'widgets/android/NextPrayer.tsx' },
  },
  {
    name: 'Tasbih',
    displayName: 'Tasbih',
    description: 'Votre compteur de tasbih. Touchez pour reprendre.',
    ios: { supportedFamilies: ['systemSmall', 'accessoryCircular'], initialLayout: 'widgets/ios/Tasbih.tsx' },
    android: { targetCellWidth: 2, targetCellHeight: 2, initialLayout: 'widgets/android/Tasbih.tsx' },
  },
  {
    name: 'DailyDhikr',
    displayName: 'Dhikr du jour',
    description: 'Un dhikr approuvé et sourcé, différent chaque jour.',
    ios: { supportedFamilies: ['systemSmall', 'systemMedium'], initialLayout: 'widgets/ios/DailyDhikr.tsx' },
    android: { targetCellWidth: 4, targetCellHeight: 2, initialLayout: 'widgets/android/DailyDhikr.tsx' },
  },
];

module.exports = ({ config }) => {
  // Apple TV uniquement. Sans EXPO_TV=1, le projet iPhone / Watch ci-dessous n’est pas modifié.
  if (process.env.EXPO_TV === '1') return withAppleTv(config);
  if (process.env.EAS_BUILD && config.experiments) {
    const { baseUrl, ...rest } = config.experiments;
    config.experiments = rest;
  }
  if (process.env.ZIKRU_NO_WIDGETS !== '1') {
    const bundle = config.ios && config.ios.bundleIdentifier;
    config.plugins = [
      ...(config.plugins || []),
      [
        'expo-widgets',
        {
          bundleIdentifier: bundle ? `${bundle}.widgets` : undefined,
          groupIdentifier: bundle ? `group.${bundle}` : undefined,
          enablePushNotifications: false,
          enableAndroid: true,
          widgets: WIDGETS,
        },
      ],
    ];
  }
  if (process.env.ZIKRU_NO_SIRI !== '1') {
    const exp = config.experiments || {};
    const inline = exp.inlineModules || {};
    const dirs = new Set([...(inline.watchedDirectories || []), 'app-intents']);
    config.experiments = { ...exp, inlineModules: { ...inline, watchedDirectories: [...dirs] } };
    config.plugins = [...(config.plugins || []), 'expo-app-intents'];
  }
  config.plugins = [...(config.plugins || []), 'expo-iap'];
  // Montre : cible watchOS embarquée (SwiftUI) + complication WidgetKit.
  // L’identifiant d’équipe est celui déjà utilisé pour la soumission (eas.json).
  config.ios = config.ios || {};
  if (!config.ios.appleTeamId) config.ios.appleTeamId = 'Y9XF9RY2BU';
  config.plugins = [...(config.plugins || []), '@bacons/apple-targets', './plugins/with-watch-version.js'];
  return config;
};

const TV_DROP_INFO = [
  'NSBluetoothAlwaysUsageDescription',
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSMotionUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSLocationTemporaryUsageDescriptionDictionary',
];

/**
 * Projet tvOS séparé : même identifiant de bundle (achat universel), sans widgets,
 * sans montre, sans Bluetooth, sans appareil photo. Le plugin config-tv ne s’exécute qu’ici.
 */
function withAppleTv(config) {
  if (process.env.EAS_BUILD && config.experiments) {
    const { baseUrl, ...rest } = config.experiments;
    config.experiments = rest;
  }
  const keep = new Set(['expo-router', 'expo-audio', 'expo-iap']);
  const plugins = (config.plugins || []).filter((p) => keep.has(Array.isArray(p) ? p[0] : p));
  const audio = ['expo-audio', { microphonePermission: false, enableBackgroundPlayback: true, recordAudioAndroid: false }];
  const next = plugins.map((p) => (Array.isArray(p) && p[0] === 'expo-audio' ? audio : p));
  if (!next.some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-iap')) next.push('expo-iap');
  // config-tv écrit TVAppIcon.brandassets et ASSETCATALOG_COMPILER_APPICON_NAME.
  // actool en déduit CFBundleIcons.CFBundlePrimaryIcon et TVTopShelfImage.
  next.push(['@react-native-tvos/config-tv', {
    isTV: true,
    tvosDeploymentTarget: '16.4',
    appleTVImages: {
      iconSmallLayers: { front: './assets/tv/icon-home-front.png', back: './assets/tv/icon-home-back.png' },
      iconSmall2xLayers: { front: './assets/tv/icon-home-front@2x.png', back: './assets/tv/icon-home-back@2x.png' },
      iconLayers: { front: './assets/tv/icon-store-front.png', back: './assets/tv/icon-store-back.png' },
      topShelf: './assets/tv/top-shelf.png',
      topShelf2x: './assets/tv/top-shelf@2x.png',
      topShelfWide: './assets/tv/top-shelf-wide.png',
      topShelfWide2x: './assets/tv/top-shelf-wide@2x.png',
    },
  }]);
  next.push('./plugins/with-tv-pods.js');
  config.plugins = next;
  config.orientation = 'landscape';
  // Projet Expo distinct : les profils tvOS ne partagent pas le créneau
  // de provisionnement iPhone / Watch du projet « zikru ».
  config.slug = 'zikru-tv';
  config.owner = 'habib548';
  config.version = '1.0.30';
  config.ios = config.ios || {};
  config.ios.bundleIdentifier = 'com.vibecode.zikru-76mpdv';
  // L’envoi 1 a été refusé par App Store Connect. Le suivant doit être plus haut.
  config.ios.buildNumber = '2';
  if (!config.ios.appleTeamId) config.ios.appleTeamId = 'Y9XF9RY2BU';
  // Pas de groupe d’apps, pas de montre, pas de widget : le profil tvOS
  // de cet App ID ne porte pas ces capacités.
  config.ios.entitlements = {};
  const info = { ...(config.ios.infoPlist || {}) };
  for (const key of TV_DROP_INFO) delete info[key];
  config.ios.infoPlist = info;
  config.extra = config.extra || {};
  config.extra.eas = { ...(config.extra.eas || {}), projectId: '0093f2e3-7828-41e7-9e62-c3e06d9bee77' };
  if (config.extra.eas.build) delete config.extra.eas.build;
  // expo-updates n’est pas configuré dans ce dépôt : pas d’URL u.expo.dev.
  return config;
}
