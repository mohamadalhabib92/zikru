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
  return config;
};
