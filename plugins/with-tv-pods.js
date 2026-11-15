const { withDangerousMod, withEntitlementsPlist, withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Router est le routeur de l’app, y compris sur Apple TV (exemple with-router-tv).
 * Son podspec ne déclare que l’iOS. On ajoute tvOS et on écarte les fichiers qui
 * utilisent UIContextMenu / la barre d’outils iPhone, absents de tvOS.
 * Ce plugin n’est branché que lorsque EXPO_TV=1.
 */
function patchExpoRouterPodspec(projectRoot) {
  const file = path.join(projectRoot, 'node_modules/expo-router/ios/ExpoRouter.podspec');
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes(":tvos => '16.4'")) {
    src = src.replace("s.platforms      = {\n    :ios => '16.4'\n  }", "s.platforms      = {\n    :ios => '16.4',\n    :tvos => '16.4'\n  }");
  }
  if (!src.includes('s.tvos.exclude_files')) {
    src = src.replace("s.exclude_files = 'Tests/**/*'", "s.exclude_files = 'Tests/**/*'\n  s.tvos.exclude_files = 'LinkPreview/**/*', 'Toolbar/**/*'");
  }
  fs.writeFileSync(file, src);
}

const DROP = [
  'NSBluetoothAlwaysUsageDescription',
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSMotionUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSLocationAlwaysUsageDescription',
  'NSLocationTemporaryUsageDescriptionDictionary',
];

const DROP_ENTITLEMENTS = [
  'com.apple.security.application-groups',
  'com.apple.developer.associated-domains',
  'aps-environment',
  'com.apple.developer.healthkit',
  'com.apple.developer.applesignin',
  'com.apple.developer.networking.wifi-info',
];

function stripPhonePermissions(platformProjectRoot, projectName) {
  const plistPath = path.join(platformProjectRoot, projectName || 'Zikru', 'Info.plist');
  if (!fs.existsSync(plistPath)) return;
  let xml = fs.readFileSync(plistPath, 'utf8');
  for (const key of DROP) {
    xml = xml.replace(new RegExp(`<key>${key}</key>\\s*<(string|true|false|integer|real|dict|array)>[\\s\\S]*?</\\1>\\s*`, 'g'), '');
  }
  fs.writeFileSync(plistPath, xml);
}

const { TV_AUTOLINK_EXCLUDE } = require('../scripts/tv-native.cjs');

function patchPodfile(platformProjectRoot) {
  const file = path.join(platformProjectRoot, 'Podfile');
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, 'utf8');
  const banner = [
    "# Apple TV: the Maven React-core tarballs are the upstream iOS xcframework (0.88),",
    "# not react-native-tvos. Build that fork from source.",
    "ENV['RCT_USE_PREBUILT_RNCORE'] = '0'",
    "ENV['EXPO_USE_PRECOMPILED_MODULES'] = '0'",
    '',
  ].join('\n');
  if (!src.includes("ENV['RCT_USE_PREBUILT_RNCORE'] = '0'")) src = banner + src;
  const list = TV_AUTOLINK_EXCLUDE.map((name) => `'${name}'`).join(', ');
  if (!src.includes('use_expo_modules!(exclude:')) {
    src = src.replace('use_expo_modules!', `use_expo_modules!(exclude: [${list}])`);
  }
  fs.writeFileSync(file, src);
}

function stripEntitlementsFile(platformProjectRoot, projectName) {
  const name = projectName || 'Zikru';
  const file = path.join(platformProjectRoot, name, `${name}.entitlements`);
  if (!fs.existsSync(file)) return;
  let xml = fs.readFileSync(file, 'utf8');
  for (const key of DROP_ENTITLEMENTS) {
    xml = xml.replace(new RegExp(`<key>${key.replace(/\./g, '\\.')}</key>\\s*<(string|true|false|integer|real|array|dict)>[\\s\\S]*?</\\1>\\s*`, 'g'), '');
  }
  fs.writeFileSync(file, xml);
}

module.exports = function withTvPods(config) {
  config = withEntitlementsPlist(config, (cfg) => {
    for (const key of DROP_ENTITLEMENTS) delete cfg.modResults[key];
    return cfg;
  });
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      patchExpoRouterPodspec(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);
  // Les plugins automatiques (localisation, photos) réécrivent Info.plist après les mods utilisateur.
  return withFinalizedMod(config, [
    'ios',
    (cfg) => {
      stripPhonePermissions(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName);
      stripEntitlementsFile(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName);
      patchPodfile(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
};
