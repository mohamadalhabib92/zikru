// Apple TV : droits, compteur, et preuve que le profil iPhone ne change pas.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadLib } from './load-lib.mjs';
import { TV_AUTOLINK_EXCLUDE, TV_REACT_NATIVE, patchPackageForTv } from './tv-build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { tv } = await loadLib(['tv'], 'tv');
const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const app = require('../app.json').expo;

const empty = { v: 1, decidedAt: null, grandfather: false, zikrIds: [], localGroupIds: [], store: null };
assert.equal(tv.tvFeatureAllowed('join', false), true);
assert.equal(tv.tvFeatureAllowed('chat', false), true);
assert.equal(tv.tvFeatureAllowed('home', false), true);
assert.equal(tv.tvFeatureAllowed('quran', false), false);
assert.equal(tv.tvFeatureAllowed('prayers', false), false);
assert.equal(tv.tvFeatureAllowed('adhan', false), false);
assert.equal(tv.tvFeatureAllowed('dhikr', false), false);
assert.equal(tv.tvFeatureAllowed('ambient', false), false);
assert.equal(tv.tvFeatureAllowed('kids', false), false);
assert.equal(tv.tvFeatureAllowed('quran', true), true);
assert.equal(tv.tvPremiumActive(empty), false);
assert.equal(tv.tvPremiumActive({ ...empty, grandfather: true }), true);
assert.equal(tv.TV_BUNDLE_ID, 'com.vibecode.zikru-76mpdv');
assert.equal(tv.TV_PRODUCT_ID, 'ch.mohamadba.zikru.premium.lifetime');

const short = tv.tvAyahType('الله');
const long = tv.tvAyahType('ا'.repeat(200));
assert.ok(short.fontSize >= tv.TV_ARABIC_MIN);
assert.ok(short.fontSize > long.fontSize);
assert.equal(long.fontSize, tv.TV_ARABIC_MIN);
assert.ok(short.lineHeight >= short.fontSize);

const rows = tv.rowsFromSession([
  { user_id: 'a', display_name: 'Amina', count: 3 },
  { user_id: 'b', display_name: '', count: 10 },
  { user_id: '', display_name: 'x', count: 1 },
  { user_id: 'c', display_name: 'C', count: Number.NaN },
]);
assert.deepEqual(rows.map((r) => r.userId), ['b', 'a']);
const merged = tv.mergeCounts(rows, [{ userId: 'a', name: 'Amina', count: 12 }]);
assert.equal(merged[0].userId, 'a');
assert.equal(merged[0].count, 12);
assert.equal(tv.sessionTotal(merged, { userId: 'a', count: 14 }), 24);
assert.equal(tv.kidsCount(merged, 'b'), 10);
assert.equal(tv.kidsCount(merged, 'z'), 0);
assert.equal(tv.goalTotal([{ total: 4 }, { total: -1 }, null, { total: 2.5 }]), 6.5);

const phoneA = configure({ config: structuredClone(app) });
delete process.env.EXPO_TV;
const phoneB = configure({ config: structuredClone(app) });
assert.deepEqual(phoneA, phoneB);
assert.equal(phoneA.ios.bundleIdentifier, 'com.vibecode.zikru-76mpdv');
assert.equal(phoneA.ios.appleTeamId, 'Y9XF9RY2BU');
const names = (plugins) => plugins.map((p) => (Array.isArray(p) ? p[0] : p));
const phonePlugins = names(phoneA.plugins);
for (const must of ['expo-widgets', 'expo-app-intents', 'expo-iap', '@bacons/apple-targets', './plugins/with-watch-version.js', 'react-native-ble-plx']) {
  assert.ok(phonePlugins.includes(must), must);
}
assert.equal(phonePlugins.includes('@react-native-tvos/config-tv'), false);
assert.equal(phonePlugins.includes('./plugins/with-tv-pods.js'), false);

process.env.EXPO_TV = '1';
const tvConfig = configure({ config: structuredClone(app) });
delete process.env.EXPO_TV;
const phoneC = configure({ config: structuredClone(app) });
assert.deepEqual(phoneC, phoneA, 'revenir de EXPO_TV ne doit pas laisser de trace');
assert.equal(tvConfig.ios.bundleIdentifier, phoneA.ios.bundleIdentifier);
assert.equal(tvConfig.ios.appleTeamId, phoneA.ios.appleTeamId);
assert.equal(tvConfig.orientation, 'landscape');
const tvPlugins = names(tvConfig.plugins);
assert.ok(tvPlugins.includes('@react-native-tvos/config-tv'));
assert.ok(tvPlugins.includes('./plugins/with-tv-pods.js'));
for (const gone of ['expo-widgets', 'expo-app-intents', '@bacons/apple-targets', './plugins/with-watch-version.js', 'react-native-ble-plx', 'expo-image-picker', 'expo-location', 'expo-notifications']) {
  assert.equal(tvPlugins.includes(gone), false, gone);
}
assert.equal(tvConfig.ios.infoPlist.NSCameraUsageDescription, undefined);
assert.equal(tvConfig.ios.infoPlist.NSBluetoothAlwaysUsageDescription, undefined);
assert.equal(phoneA.ios.infoPlist.NSCameraUsageDescription.includes('appareil photo'), true);

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.dependencies['react-native'], '0.88.0');
assert.equal(pkg.dependencies['@react-native-tvos/config-tv'], undefined);
assert.equal(pkg.devDependencies['@react-native-tvos/config-tv'], '^0.1.7');
const patched = patchPackageForTv(pkg);
assert.equal(pkg.dependencies['react-native'], '0.88.0', 'le patch ne réécrit pas le fichier source');
assert.equal(patched.dependencies['react-native'], TV_REACT_NATIVE);
for (const name of TV_AUTOLINK_EXCLUDE) assert.ok(patched.expo.autolinking.exclude.includes(name), name);
assert.equal(patched.expo.autolinking.exclude.includes('expo-audio'), false);
assert.equal(patched.expo.autolinking.exclude.includes('expo-iap'), false);

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
assert.equal(eas.build.production.env, undefined);
assert.equal(eas.build.production.autoIncrement, true);
assert.equal(eas.build['production-tv'].env.EXPO_TV, '1');
assert.equal(eas.build['production-tv'].autoIncrement, false);
assert.equal(eas.build['production-tv'].ios.credentialsSource, 'local');
assert.equal(eas.submit['production-tv'], undefined);

function expoConfig(expoTv) {
  const env = { ...process.env };
  if (expoTv) env.EXPO_TV = '1';
  else delete env.EXPO_TV;
  const out = execFileSync('npx', ['expo', 'config', '--json', '--type', 'prebuild'], { cwd: root, env, encoding: 'utf8' });
  return JSON.parse(out);
}
const livePhone = expoConfig(false);
const liveTv = expoConfig(true);
assert.equal(livePhone.ios.bundleIdentifier, 'com.vibecode.zikru-76mpdv');
assert.equal(liveTv.ios.bundleIdentifier, livePhone.ios.bundleIdentifier);
assert.deepEqual(names(livePhone.plugins), phonePlugins);
assert.ok(names(liveTv.plugins).includes('@react-native-tvos/config-tv'));
assert.equal(names(liveTv.plugins).includes('expo-widgets'), false);
const phoneExt = livePhone.extra?.eas?.build?.experimental?.ios?.appExtensions ?? [];
assert.ok(phoneExt.some((e) => e.bundleIdentifier === 'com.vibecode.zikru-76mpdv.widgets'));
assert.ok(phoneExt.some((e) => e.bundleIdentifier === 'com.vibecode.zikru-76mpdv.watchkitapp'));
assert.equal(liveTv.extra?.eas?.build?.experimental?.ios?.appExtensions, undefined);
const linked = livePhone._internal?.autolinkedModules ?? [];
for (const mod of ['zikru-watch', 'zikru-ocr', 'expo-widgets', 'expo-iap', 'expo-haptics', 'expo-location', 'expo-notifications']) assert.ok(linked.includes(mod), mod);
assert.equal(linked.includes('@react-native-tvos/config-tv'), false);
assert.equal(linked.includes('react-native-ble-plx'), false, 'ble-plx est lié par son plugin, pas par la liste Expo');

console.log('test-tv OK');
