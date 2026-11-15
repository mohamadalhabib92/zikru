const { withDangerousMod, withEntitlementsPlist, withFinalizedMod, withPodfileProperties } = require('expo/config-plugins');
const fs = require('fs');
const os = require('os');
const path = require('path');
const xcode = require('xcode');

/** Highest tvOS minimum among the pods this build links (Expo 58 is 16.4; nothing is higher). */
const TVOS_DEPLOYMENT_TARGET = '16.4';

/**
 * Expo Router est le routeur de l’app, y compris sur Apple TV (exemple with-router-tv).
 * Son podspec ne déclare que l’iOS. On ajoute tvOS, on écarte Link Preview et la
 * barre d’outils, et on neutralise CoreSpotlight / Photos, absents de tvOS.
 * Ce plugin n’est branché que lorsque EXPO_TV=1.
 */
function patchExpoRouterPodspec(projectRoot) {
  // Le hook post-install fait le même travail. On le refait ici : prebuild
  // peut tourner sans ce hook, et le second passage ne change plus les fichiers.
  const { patchTvNativeSources } = require('../scripts/tv-native-patch.cjs');
  const report = patchTvNativeSources(projectRoot);
  if (report.remaining.length) {
    throw new Error(`tvOS native APIs still compiled:\n${report.remaining.join('\n')}`);
  }
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

function patchPodfileSource(src) {
  let next = src;
  const banner = [
    "# Apple TV: the Maven React-core tarballs are the upstream iOS xcframework (0.88),",
    "# not react-native-tvos. Build that fork from source.",
    "ENV['RCT_USE_PREBUILT_RNCORE'] = '0'",
    "ENV['EXPO_USE_PRECOMPILED_MODULES'] = '0'",
    '',
  ].join('\n');
  if (!next.includes("ENV['RCT_USE_PREBUILT_RNCORE'] = '0'")) next = banner + next;
  const list = TV_AUTOLINK_EXCLUDE.map((name) => `'${name}'`).join(', ');
  if (!next.includes('use_expo_modules!(exclude:')) {
    next = next.replace('use_expo_modules!', `use_expo_modules!(exclude: [${list}])`);
  }
  next = next.replace(/^platform :(ios|tvos),.*$/m, `platform :tvos, '${TVOS_DEPLOYMENT_TARGET}'`);
  if (!next.includes(`platform :tvos, '${TVOS_DEPLOYMENT_TARGET}'`)) {
    throw new Error('tvOS Podfile has no platform line to raise to 16.4');
  }
  return insertTvosDeploymentPostInstall(next);
}

function insertTvosDeploymentPostInstall(src) {
  const marker = "config.build_settings['TVOS_DEPLOYMENT_TARGET'] = '16.4'";
  if (src.includes(marker)) return src;
  const start = src.indexOf('post_install do |installer|');
  if (start < 0) throw new Error('tvOS Podfile has no post_install block');
  const lineStart = src.lastIndexOf('\n', start) + 1;
  const indent = src.slice(lineStart, start).match(/^\s*/)[0];
  const endAt = src.slice(start).search(new RegExp(`\\n${indent}end\\b`));
  if (endAt < 0) throw new Error('tvOS Podfile post_install has no matching end');
  const block = [
    '',
    `${indent}  # Expo modules are built for tvOS ${TVOS_DEPLOYMENT_TARGET}. Keep every pod at least that high.`,
    `${indent}  installer.pods_project.targets.each do |target|`,
    `${indent}    target.build_configurations.each do |config|`,
    `${indent}      version = config.build_settings['TVOS_DEPLOYMENT_TARGET'].to_s`,
    `${indent}      if version.empty? || version !~ /\\A\\d+(\\.\\d+)*\\z/ || Gem::Version.new(version) < Gem::Version.new('${TVOS_DEPLOYMENT_TARGET}')`,
    `${indent}        ${marker}`,
    `${indent}      end`,
    `${indent}    end`,
    `${indent}  end`,
    `${indent}  installer.pods_project.build_configurations.each do |config|`,
    `${indent}    version = config.build_settings['TVOS_DEPLOYMENT_TARGET'].to_s`,
    `${indent}    if version.empty? || version !~ /\\A\\d+(\\.\\d+)*\\z/ || Gem::Version.new(version) < Gem::Version.new('${TVOS_DEPLOYMENT_TARGET}')`,
    `${indent}      ${marker}`,
    `${indent}    end`,
    `${indent}  end`,
    '',
  ].join('\n');
  const insertAt = start + endAt;
  return src.slice(0, insertAt) + block + src.slice(insertAt);
}

function patchPodfile(platformProjectRoot) {
  const file = path.join(platformProjectRoot, 'Podfile');
  if (!fs.existsSync(file)) return;
  const next = patchPodfileSource(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, next);
}

function setTargetTvosDeploymentTarget(pbxproj, targetName) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zikru-tv-'));
  const file = path.join(dir, 'project.pbxproj');
  fs.writeFileSync(file, pbxproj);
  const project = xcode.project(file);
  try {
    project.parseSync();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const nativeTargets = project.pbxNativeTargetSection();
  const lists = project.pbxXCConfigurationList();
  const configurations = project.pbxXCBuildConfigurationSection();
  const wantedLists = new Set();
  for (const key of Object.keys(nativeTargets)) {
    if (key.endsWith('_comment')) continue;
    const target = nativeTargets[key];
    const name = String(target.name || '').replace(/^"|"$/g, '');
    if (name === targetName) wantedLists.add(String(target.buildConfigurationList).split(' ')[0]);
  }
  if (wantedLists.size === 0) {
    throw new Error(`tvOS deployment: Xcode target ${targetName} was not found`);
  }
  const wantedConfigs = new Set();
  for (const key of Object.keys(lists)) {
    if (key.endsWith('_comment')) continue;
    if (!wantedLists.has(key)) continue;
    for (const item of lists[key].buildConfigurations || []) wantedConfigs.add(item.value);
  }
  let updated = 0;
  for (const id of wantedConfigs) {
    const config = configurations[id];
    if (!config?.buildSettings) continue;
    config.buildSettings.TVOS_DEPLOYMENT_TARGET = TVOS_DEPLOYMENT_TARGET;
    updated += 1;
  }
  if (updated === 0) throw new Error(`tvOS deployment: target ${targetName} has no build configurations`);
  return project.writeSync();
}

function patchAppDeploymentTarget(platformProjectRoot, projectName) {
  const name = projectName || 'Zikru';
  const file = path.join(platformProjectRoot, `${name}.xcodeproj`, 'project.pbxproj');
  if (!fs.existsSync(file)) return;
  const next = setTargetTvosDeploymentTarget(fs.readFileSync(file, 'utf8'), name);
  fs.writeFileSync(file, next);
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

function withTvPods(config) {
  config = withEntitlementsPlist(config, (cfg) => {
    for (const key of DROP_ENTITLEMENTS) delete cfg.modResults[key];
    return cfg;
  });
  config = withPodfileProperties(config, (cfg) => {
    cfg.modResults['tvos.deploymentTarget'] = TVOS_DEPLOYMENT_TARGET;
    cfg.modResults['ios.deploymentTarget'] = TVOS_DEPLOYMENT_TARGET;
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
      patchAppDeploymentTarget(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName);
      return cfg;
    },
  ]);
}

module.exports = withTvPods;
module.exports.TVOS_DEPLOYMENT_TARGET = TVOS_DEPLOYMENT_TARGET;
module.exports.patchPodfileSource = patchPodfileSource;
module.exports.setTargetTvosDeploymentTarget = setTargetTvosDeploymentTarget;
