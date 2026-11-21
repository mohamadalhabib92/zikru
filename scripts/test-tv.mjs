// Apple TV : droits, compteur, et preuve que le profil iPhone ne change pas.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLib } from './load-lib.mjs';
import { TV_AUTOLINK_EXCLUDE, TV_REACT_NATIVE, lockedReactNative, omitReactNativeFromLock, patchPackageForTv, shouldSwapReactNativeOnEas } from './tv-build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const { tv } = await loadLib(['tv'], 'tv');
const { 'tv-surface': surface } = await loadLib(['tv-surface'], 'tv-surface');
const require = createRequire(import.meta.url);
const { compiledFor, patchTvNativeSources, scanTvNativeSources } = require('../scripts/tv-native-patch.cjs');
const { TVOS_DEPLOYMENT_TARGET, patchPodfileSource, setTargetTvosDeploymentTarget } = require('../plugins/with-tv-pods.js');
const configure = require('../app.config.js');
const app = require('../app.json').expo;

const empty = { v: 1, decidedAt: null, grandfather: false, zikrIds: [], localGroupIds: [], store: null };
const freeOnTv = ['home', 'join', 'chat', 'quran', 'prayers', 'adhan', 'dhikr', 'kids', 'ambient'];
for (const id of freeOnTv) {
  assert.equal(tv.tvFeatureAllowed(id, false, false), true, `${id} reste gratuit sans module d’achat`);
  assert.equal(tv.tvPaywallVisible(id, false, false), false, `${id} pas de mur`);
  assert.equal(tv.TV_FEATURES[id].premium, false, id);
}
assert.equal(tv.tvFeatureAllowed('themes', false, false), false);
assert.equal(tv.tvPaywallVisible('themes', false, false), true);
assert.equal(tv.tvFeatureAllowed('themes', true, false), true, 'droit déjà connu, même si l’achat est indisponible');
assert.equal(tv.tvPaywallVisible('themes', true, false), false);
assert.equal(tv.tvFeatureAllowed('tijaniGuide', false, true), false);
assert.equal(tv.tvPaywallVisible('tijaniGuide', true, true), false);
assert.equal(tv.tvPremiumActive(empty, null), false);
assert.equal(tv.tvPremiumActive(empty, { plan: 'free', limits: { themes: false } }), false);
assert.equal(tv.tvPremiumActive(empty, { plan: 'premium' }), true);
assert.equal(tv.tvPremiumActive(empty, { plan: 'lifetime' }), true);
assert.equal(tv.tvPremiumActive(empty, { plan: 'free', limits: { themes: true } }), true);
assert.equal(tv.tvPremiumActive({ ...empty, grandfather: true }, { plan: 'free' }), true);
assert.equal(tv.tvPremiumActive(empty), false);
assert.equal(tv.tvPremiumActive({ ...empty, grandfather: true }), true);
assert.equal(tv.TV_BUNDLE_ID, 'com.vibecode.zikru-76mpdv');
const { 'premium-logic': premiumLogic } = await loadLib(['premium-logic'], 'tv-premium');
assert.equal(premiumLogic.PREMIUM_PRODUCT_ID, 'ch.mohamadba.zikru.premium.lifetime');
assert.equal(tv.TV_PRODUCT_ID, premiumLogic.PREMIUM_PRODUCT_ID);
assert.notEqual(tv.TV_PRODUCT_ID, 'com.vibecode.zikru-76mpdv.premium.lifetime');
const src = readFileSync(new URL('../src/lib/premium-logic.ts', import.meta.url), 'utf8');
assert.match(src, /PREMIUM_PRODUCT_ID = 'ch\.mohamadba\.zikru\.premium\.lifetime'/);
assert.equal(src.includes('com.vibecode.zikru-76mpdv.premium.lifetime'), false);

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
assert.equal(phoneA.slug, 'zikru');
assert.equal(phoneA.extra.eas.projectId, '92e1bb51-c48f-41ed-9131-13a6ed6bdb22');
assert.equal(phoneA.ios.buildNumber, '86');
assert.equal(tvConfig.slug, 'zikru-tv');
assert.equal(tvConfig.owner, 'habib548');
assert.equal(tvConfig.version, '1.0.30');
assert.equal(tvConfig.extra.eas.projectId, '0093f2e3-7828-41e7-9e62-c3e06d9bee77');
assert.equal(tvConfig.ios.buildNumber, '7');
assert.equal(tvConfig.ios.bundleIdentifier, phoneA.ios.bundleIdentifier);
assert.equal(tvConfig.ios.appleTeamId, phoneA.ios.appleTeamId);
assert.equal(tvConfig.orientation, 'landscape');
const tvPlugins = names(tvConfig.plugins);
assert.ok(tvPlugins.includes('@react-native-tvos/config-tv'));
assert.ok(tvPlugins.includes('./plugins/with-tv-pods.js'));
const tvosPlugin = tvConfig.plugins.find((p) => Array.isArray(p) && p[0] === '@react-native-tvos/config-tv');
assert.equal(tvosPlugin[1].tvosDeploymentTarget, '16.4');
assert.equal(tvosPlugin[1].appleTVImages.iconLayers.front, './assets/tv/icon-store-front.png');
assert.equal(tvosPlugin[1].appleTVImages.iconSmall2xLayers.back, './assets/tv/icon-home-back@2x.png');
assert.equal(tvosPlugin[1].appleTVImages.topShelfWide2x, './assets/tv/top-shelf-wide@2x.png');
assert.equal(phoneA.plugins.some((p) => Array.isArray(p) && p[1] && p[1].appleTVImages), false);
assert.equal(phoneA.ios.deploymentTarget, undefined);
assert.equal(tvConfig.ios.deploymentTarget, undefined);
for (const gone of ['expo-widgets', 'expo-app-intents', '@bacons/apple-targets', './plugins/with-watch-version.js', 'react-native-ble-plx', 'expo-image-picker', 'expo-location', 'expo-notifications']) {
  assert.equal(tvPlugins.includes(gone), false, gone);
}
assert.equal(tvConfig.ios.infoPlist.NSCameraUsageDescription, undefined);
assert.equal(tvConfig.ios.infoPlist.NSBluetoothAlwaysUsageDescription, undefined);
assert.equal(phoneA.ios.infoPlist.NSCameraUsageDescription.includes('appareil photo'), true);
assert.equal(app.splash, undefined, 'SDK 58 retire splash du schéma app.json');

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
assert.equal(eas.build['production-tv'].env.EXPO_NO_CAPABILITY_SYNC, '1');
assert.equal(eas.build['production-tv'].env.RCT_USE_PREBUILT_RNCORE, '0');
assert.ok(TV_AUTOLINK_EXCLUDE.includes('@livekit/react-native-expo-plugin'));
assert.ok(TV_AUTOLINK_EXCLUDE.includes('expo-iap') === false);
assert.ok(TV_AUTOLINK_EXCLUDE.includes('expo-audio') === false);
assert.equal(eas.build['production-tv'].autoIncrement, true);
assert.equal(eas.build['production-tv'].ios.credentialsSource, 'remote');
assert.equal(eas.build.production.ios, undefined);
assert.equal(eas.cli.appVersionSource, 'remote');
const tvUi = readFileSync(new URL('../src/components/tv/ui.tsx', import.meta.url), 'utf8');
assert.match(tvUi, /paddingHorizontal: TV_PAD_X/);
assert.match(tvUi, /paddingTop: TV_PAD_TOP/);
assert.match(tvUi, /paddingBottom: TV_PAD_BOTTOM/);
assert.match(tvUi, /useWindowDimensions/);
assert.match(tvUi, /chunkTv/);
assert.equal(tvUi.includes('Dimensions.get'), false);
assert.equal(tvUi.includes('#C9D0CB'), false);
assert.match(tvUi, /color: t\.text/);
assert.match(tvUi, /TV_ON_CARD/);
assert.match(tvUi, /overflow: 'visible'/);
assert.match(tvUi, /if \(!TV_FEATURES\[feature\]\.premium\) return/);
assert.match(tvUi, /Restaurer les achats/);
assert.match(tvUi, /TVPressable/);
const tvPress = readFileSync(new URL('../src/ui/tv-pressable.tsx', import.meta.url), 'utf8');
assert.match(tvPress, /scale: on \? 1\.08 : 1/);
assert.match(tvPress, /opacity: 1/);
assert.equal(tvPress.includes('0.65'), false);
assert.match(tvPress, /borderWidth: 4/);
assert.match(tvPress, /onFocus=/);
assert.match(tvPress, /onBlur=/);
assert.match(tvPress, /if \(!Platform\.isTV \|\| props\.tvPlain\)/);
assert.match(tvUi, /onFocus=/);
assert.match(tvUi, /onBlur=/);
assert.match(tvUi, /hasTVPreferredFocus=\{arm\}/);
assert.match(tvUi, /TVFocusGuideView/);
assert.match(tvUi, /removeClippedSubviews=\{false\}/);
assert.match(tvUi, /animated: false/);
const tvLayout = readFileSync(new URL('../src/app/tv/_layout.tsx', import.meta.url), 'utf8');
assert.match(tvLayout, /export function ErrorBoundary/);
assert.match(tvLayout, /hardwareBackPress/);
assert.match(tvLayout, /Platform\.isTV/);
assert.match(tvLayout, /subscribeTvMenu/);
assert.match(tvLayout, /syncTvMenuKey/);
assert.match(tvLayout, /tvMenuCaptures/);
assert.equal(/new\s+(Ctor|TVEventHandler)\s*\(/.test(tvLayout), false);
const quranList = readFileSync(new URL('../src/app/tv/quran/index.tsx', import.meta.url), 'utf8');
assert.match(quranList, /TvVirtualList/);
assert.match(quranList, /grid/);
assert.match(quranList, /<TvBack \/>/);
assert.match(tvUi, /TVFocusGuideView style=\{\{ flex: 1, backgroundColor: t\.bg \}\}>\s*<FlatList/);
assert.match(tvUi, /style=\{\{ flex: 1 \}\}/);
assert.match(tvUi, /contentContainerStyle=\{\[tvPad, \{ flexGrow: 1 \}\]\}/);
assert.equal(surface.TV_BUTTON_MIN_WIDTH >= 120, true);
assert.equal(surface.TV_BUTTON_LABEL_SIZE >= 28, true);
assert.equal(surface.TV_BUTTON_HINT_SIZE >= 28, true);
const loose = surface.tvButtonLabelBox(false);
assert.equal(loose.flexGrow, 0);
assert.equal(loose.flexBasis, 'auto');
assert.notEqual(loose.flexBasis, 0);
const tile = surface.tvButtonLabelBox(true);
assert.equal(tile.flexGrow, 1);
assert.equal(tile.flexBasis, 'auto');
const restInk = surface.tvButtonInk(false);
const focusInk = surface.tvButtonInk(true);
assert.equal(restInk.ink, surface.TV_ON_CARD);
assert.equal(focusInk.ink, surface.TV_FOCUS_INK);
assert.equal(focusInk.hint, surface.TV_FOCUS_INK);
function hexContrast(a, b) {
  const lum = (hex) => {
    const h = hex.replace('#', '');
    const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
assert.ok(hexContrast(restInk.ink, surface.TV_CARD_BG) >= 4.5, 'label au repos');
assert.ok(hexContrast(restInk.hint, surface.TV_CARD_BG) >= 4.5, 'sous-titre au repos');
assert.ok(hexContrast(focusInk.ink, surface.TV_FOCUS_FILL) >= 4.5, 'label au focus');
assert.ok(hexContrast(focusInk.hint, surface.TV_FOCUS_FILL) >= 4.5, 'sous-titre au focus');
assert.match(tvUi, /tvButtonLabelBox/);
assert.equal(tvUi.includes('<View style={{ flex: 1 }}>'), false);
const rootLayout = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
assert.equal(rootLayout.includes('initialRouteName'), false);
assert.match(rootLayout, /tvLaunchHref/);
assert.match(rootLayout, /<Redirect href=\{tvHome\} \/>/);
const tabsLayout = readFileSync(new URL('../src/app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const tvTabs = tabsLayout.indexOf('if (Platform.isTV) return <Redirect href="/tv" />');
const onboarded = tabsLayout.indexOf('!s.onboarded');
assert.ok(tvTabs !== -1 && onboarded !== -1 && tvTabs < onboarded);
const onboarding = readFileSync(new URL('../src/app/onboarding.tsx', import.meta.url), 'utf8');
assert.match(onboarding, /if \(Platform\.isTV\) return <Redirect href="\/tv" \/>/);
const homeTv = readFileSync(new URL('../src/app/tv/index.tsx', import.meta.url), 'utf8');
assert.match(homeTv, /useTvGrid/);
assert.equal(homeTv.includes("width: '31%'"), false);
assert.equal(homeTv.includes('minWidth: 320'), false);
assert.match(homeTv, /TV_FEATURES\[tile\.feature\]\.premium/);
assert.match(tvPress, /#F6E7B8/);
const quranIndex = readFileSync(new URL('../src/app/tv/quran/index.tsx', import.meta.url), 'utf8');
assert.equal(quranIndex.includes("position: 'absolute'"), false);
const surahScreen = readFileSync(new URL('../src/app/tv/quran/[n].tsx', import.meta.url), 'utf8');
assert.equal(surahScreen.includes("from 'expo-keep-awake'"), false);
assert.match(surahScreen, /export function ErrorBoundary/);
assert.match(surahScreen, /TV_ON_CARD/);
assert.equal(surahScreen.includes("on ? '#141311' : t.text"), false);
assert.equal(surahScreen.includes(': t.muted'), false);

assert.equal(surface.TV_PAD_X, 90);
assert.equal(surface.TV_PAD_TOP, 60);
assert.equal(surface.TV_PAD_BOTTOM, 72);
assert.equal(surface.TV_FOCUS_SCALE, 1.08);
assert.equal(surface.tvLaunchHref('/', false), null);
assert.equal(surface.tvLaunchHref('/onboarding', false), null);
assert.equal(surface.tvLaunchHref('/tv', false), null);
assert.equal(surface.tvLaunchHref('/', true), '/tv');
assert.equal(surface.tvLaunchHref('', true), '/tv');
assert.equal(surface.tvLaunchHref('/onboarding', true), '/tv');
assert.equal(surface.tvLaunchHref('/(tabs)', true), '/tv');
assert.equal(surface.tvLaunchHref('/quran/1', true), '/tv');
assert.equal(surface.tvLaunchHref('/tv', true), null);
assert.equal(surface.tvLaunchHref('/tv/', true), null);
assert.equal(surface.tvLaunchHref('/tv/quran/2', true), null);
assert.equal(surface.tvMenuCaptures('/tv'), false);
assert.equal(surface.tvMenuCaptures('/tv/'), false);
assert.equal(surface.tvMenuCaptures('/'), false);
assert.equal(surface.tvMenuCaptures('/tv/join'), true);
assert.equal(surface.tvMenuCaptures('/tv/quran/18'), true);

const lum = (hex) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
for (const [fg, bg, name] of [
  [surface.TV_ON_CARD, surface.TV_CARD_BG, 'texte sur carte'],
  [surface.TV_ON_CARD_MUTED, surface.TV_CARD_BG, 'hint sur carte'],
  [surface.TV_BADGE_ON_CARD, surface.TV_CARD_BG, 'badge sur carte'],
  [surface.TV_FOCUS_INK, surface.TV_FOCUS_FILL, 'texte focalisé'],
  [surface.TV_FOCUS_MUTED, surface.TV_FOCUS_FILL, 'hint focalisé'],
]) {
  assert.ok(ratio(fg, bg) >= 4.5, `${name} ${ratio(fg, bg).toFixed(2)}`);
}

for (const width of [1280, 1600, 1920, 2560]) {
  const grid = surface.tvGrid(width);
  assert.ok(grid.columns >= 3 && grid.columns <= 4, `${width} → ${grid.columns} colonnes`);
  assert.equal(surface.focusOverlaps(grid.tileWidth, grid.gap), false, String(width));
  const used = grid.tileWidth * grid.columns + grid.gap * (grid.columns - 1);
  assert.ok(used <= grid.contentWidth, `${width} déborde ${used} > ${grid.contentWidth}`);
  assert.ok(grid.tileWidth >= 280, String(width));
}
const narrow = surface.tvGrid(960);
assert.ok(narrow.columns >= 2, 'un écran étroit ne revient pas à une seule colonne étirée');
assert.equal(surface.focusOverlaps(narrow.tileWidth, narrow.gap), false);
const surahs = Array.from({ length: 114 }, (_, i) => i + 1);
const wideRows = surface.chunkTv(surahs, surface.tvGrid(1920).columns);
assert.equal(wideRows.length, Math.ceil(114 / 4));
assert.equal(wideRows[0].length, 4);
assert.equal(wideRows.at(-1).length, 114 % 4);
assert.equal(wideRows[0][3].index, 3);
assert.equal(surface.chunkTv(surahs, 1).length, 114);

let menus = 0;
let removed = false;
const listeners = [];
const modern = {
  addListener(cb) {
    listeners.push(cb);
    return { remove() { removed = true; } };
  },
};
assert.throws(() => new modern(), TypeError);
const sub = surface.subscribeTvMenu(modern, () => { menus += 1; });
listeners[0]({ eventType: 'menu' });
listeners[0]({ eventType: 'select' });
assert.equal(menus, 1);
assert.equal(listeners.length, 1);
sub.remove();
assert.equal(removed, true);

const broken = { addListener() { throw new TypeError('TVEventHandler is not a constructor'); } };
assert.doesNotThrow(() => surface.subscribeTvMenu(broken, () => {}).remove());
function Legacy() {}
Legacy.prototype.enable = function enable(_cmp, cb) { this.cb = cb; };
Legacy.prototype.disable = function disable() { this.off = true; };
const legacy = surface.subscribeTvMenu(Legacy, () => { menus += 1; });
assert.equal(typeof legacy.remove, 'function');
legacy.remove();

const control = {
  enabled: 0,
  disabled: 0,
  enableTVMenuKey() { this.enabled += 1; },
  disableTVMenuKey() { this.disabled += 1; },
};
surface.syncTvMenuKey(control, true);
surface.syncTvMenuKey(control, false);
surface.syncTvMenuKey(null, true);
assert.equal(control.enabled, 1);
assert.equal(control.disabled, 1);
let backs = 0;
const gate = surface.createTvMenuGate(() => { backs += 1; });
assert.equal(gate(true), true);
assert.equal(gate(true), false);
assert.equal(gate(false), false);
assert.equal(backs, 1);
const recitation = readFileSync(new URL('../src/lib/use-recitation.ts', import.meta.url), 'utf8');
assert.match(recitation, /const lockScreen = native && !Platform\.isTV/);
assert.match(recitation, /keepAudioSessionActive: !Platform\.isTV/);
const playerBar = readFileSync(new URL('../src/components/PlayerBar.tsx', import.meta.url), 'utf8');
assert.match(playerBar, /shouldPlayInBackground: !Platform\.isTV/);
const adhan = readFileSync(new URL('../src/lib/adhan-playback.ts', import.meta.url), 'utf8');
assert.match(adhan, /if \(Platform\.isTV \|\| !player\) return/);
const audioDl = readFileSync(new URL('../src/lib/audio-dl.ts', import.meta.url), 'utf8');
assert.match(audioDl, /if \(Platform\.isTV\) return ayahUrl/);
assert.equal(eas.submit['production-tv'].ios.ascAppId, '6773032754');
assert.equal(eas.submit.production.ios.ascAppId, '6773032754');
assert.equal(shouldSwapReactNativeOnEas({ EXPO_TV: '1', EAS_BUILD: 'true' }), true);
assert.equal(shouldSwapReactNativeOnEas({ EXPO_TV: '1' }), false);
assert.equal(shouldSwapReactNativeOnEas({ EAS_BUILD: 'true' }), false);
assert.equal(pkg.scripts['eas-build-pre-install'], 'node scripts/eas-tv-preinstall.mjs');
assert.equal(pkg.scripts['eas-build-post-install'], 'node scripts/eas-tv-preinstall.mjs --check-installed');
const sampleLock = {
  packages: {
    '': { dependencies: { 'react-native': '0.88.0', react: '19.0.0' } },
    'node_modules/react-native': { version: '0.88.0', resolved: 'https://registry.npmjs.org/react-native/-/react-native-0.88.0.tgz' },
    'node_modules/react-native/node_modules/example': { version: '1.0.0' },
    'node_modules/react': { version: '19.0.0' },
  },
  dependencies: { 'react-native': { version: '0.88.0' } },
};
const stripped = omitReactNativeFromLock(sampleLock);
assert.equal(lockedReactNative(stripped).version, '');
assert.equal(stripped.packages['node_modules/react-native/node_modules/example'], undefined);
assert.equal(stripped.packages[''].dependencies['react-native'], undefined);
assert.equal(stripped.packages[''].dependencies.react, '19.0.0');
assert.equal(stripped.packages['node_modules/react'].version, '19.0.0');
assert.equal(stripped.dependencies['react-native'], undefined);
assert.equal(sampleLock.packages['node_modules/react-native'].version, '0.88.0');

const lockBefore = readFileSync(new URL('../package-lock.json', import.meta.url));
const pkgBefore = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const knownBeforePatch = [
  'expo-file-system/ios/Legacy/EXFileSystemAssetLibraryHandler.m',
  'expo-file-system/ios/Legacy/FileSystemHelpers.swift',
  'expo-file-system/ios/Legacy/FileSystemLegacyModule.swift',
];
for (const hit of scanTvNativeSources(root)) {
  assert.ok(knownBeforePatch.some((file) => hit.includes(file)), hit);
}
const tvRoot = path.join(root, '.tmp-tv-native');
rmSync(tvRoot, { recursive: true, force: true });
mkdirSync(tvRoot);
for (const rel of [
  'node_modules/expo-router/ios/ExpoHeadModule.swift',
  'node_modules/expo-router/ios/ExpoHeadAppDelegateSubscriber.swift',
  'node_modules/expo-router/ios/ExpoRouter.podspec',
  'node_modules/expo-router/expo-module.config.json',
  'node_modules/expo-router/package.json',
  'node_modules/expo-file-system/ios/Legacy/FileSystemHelpers.swift',
  'node_modules/expo-file-system/ios/Legacy/FileSystemLegacyModule.swift',
  'node_modules/expo-file-system/ios/Legacy/EXFileSystemAssetLibraryHandler.m',
  'node_modules/expo-file-system/ios/ExpoFileSystem.podspec',
  'node_modules/expo-file-system/package.json',
  'node_modules/expo-audio/ios/AudioRecordingRequester.swift',
  'node_modules/expo-audio/ios/ExpoAudio.podspec',
  'node_modules/expo-audio/package.json',
  'node_modules/expo-haptics/ios/HapticsModule.swift',
  'node_modules/expo-haptics/ios/ExpoHaptics.podspec',
  'node_modules/expo-haptics/package.json',
]) {
  const from = path.join(root, rel);
  const to = path.join(tvRoot, rel);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to);
}
mkdirSync(path.join(tvRoot, 'node_modules/expo-router/ios/LinkPreview'), { recursive: true });
mkdirSync(path.join(tvRoot, 'node_modules/expo-router/ios/Toolbar'), { recursive: true });
writeFileSync(path.join(tvRoot, 'node_modules/expo-router/ios/LinkPreview/LinkPreviewNativeModule.swift'), 'public class LinkPreviewNativeModule: Module {}\n');
writeFileSync(path.join(tvRoot, 'node_modules/expo-router/ios/Toolbar/RouterToolbarModule.swift'), 'public class RouterToolbarModule: Module {}\n');
const native = patchTvNativeSources(tvRoot);
assert.ok(native.patched.some((file) => file.endsWith('ExpoHeadModule.swift')));
assert.ok(native.patched.some((file) => file.endsWith('expo-module.config.json')));
assert.deepEqual(native.remaining, []);
const routerModules = JSON.parse(readFileSync(path.join(tvRoot, 'node_modules/expo-router/expo-module.config.json'), 'utf8'));
assert.deepEqual(routerModules.apple.modules, ['ExpoHeadModule']);
assert.deepEqual(routerModules.apple.appDelegateSubscribers, ['ExpoHeadAppDelegateSubscriber']);
const banned = /\bCSSearchable\w*|\bCSQueryContinuationActionType\b|\bCSSearchQueryString\b|\.persistentIdentifier\b|\.isEligibleForPrediction\b|\.contentAttributeSet\b|\.domainIdentifier\b|\bimport CoreSpotlight\b|\bimport Photos\b|\bPHPhotoLibrary\b|\bPHAssetResource\b|#import <Photos\//;
const headTv = compiledFor(readFileSync(path.join(tvRoot, 'node_modules/expo-router/ios/ExpoHeadModule.swift'), 'utf8'), 'tvos');
const headIos = compiledFor(readFileSync(path.join(tvRoot, 'node_modules/expo-router/ios/ExpoHeadModule.swift'), 'utf8'), 'ios');
assert.equal(banned.test(headTv), false, headTv.match(banned)?.[0]);
assert.match(headIos, /CSSearchableIndex\.default/);
assert.equal(headIos.includes('activities: [String: NSUserActivity]'), false);
const subRaw = readFileSync(path.join(tvRoot, 'node_modules/expo-router/ios/ExpoHeadAppDelegateSubscriber.swift'), 'utf8');
const subTv = compiledFor(subRaw, 'tvos');
const subIos = compiledFor(subRaw, 'ios');
assert.equal(subTv.includes('CSSearchQueryString'), false);
assert.match(subIos, /CSSearchQueryString/);
assert.match(subTv, /wellKnownHref/);
assert.match(subRaw, /#if !os\(tvOS\)\n    if let wellKnownHref/);
assert.match(subIos, /\} else if userActivity\.activityType == CSQueryContinuationActionType/);
const subLines = subRaw.split('\n');
subLines.forEach((line, index) => {
  if (!line.trim().startsWith('#if') && !line.trim().startsWith('#else')) return;
  const next = subLines.slice(index + 1).find((item) => item.trim() && !item.trim().startsWith('//'));
  assert.equal(/^else\b/.test((next || '').trim()), false, `branche #if vide ou else orphelin: ${next}`);
});
const helperTv = compiledFor(readFileSync(path.join(tvRoot, 'node_modules/expo-file-system/ios/Legacy/FileSystemHelpers.swift'), 'utf8'), 'tvos');
const helperIos = compiledFor(readFileSync(path.join(tvRoot, 'node_modules/expo-file-system/ios/Legacy/FileSystemHelpers.swift'), 'utf8'), 'ios');
assert.equal(helperTv.includes('import Photos'), false);
assert.match(helperTv, /copyPHAsset\(fromUrl:/);
assert.match(helperIos, /import Photos/);
assert.match(helperIos, /PHAssetResourceManager/);
const legacyTv = compiledFor(readFileSync(path.join(tvRoot, 'node_modules/expo-file-system/ios/Legacy/FileSystemLegacyModule.swift'), 'utf8'), 'tvos');
assert.equal(legacyTv.includes('PHAssetResourceManager'), false);
assert.match(legacyTv, /copyPHAsset\(fromUrl: fromUrl, toUrl: toUrl, promise: promise\)/);
const libraryTv = compiledFor(readFileSync(path.join(tvRoot, 'node_modules/expo-file-system/ios/Legacy/EXFileSystemAssetLibraryHandler.m'), 'utf8'), 'tvos');
assert.equal(libraryTv.includes('PHAsset'), false);
assert.match(libraryTv, /not available on tvOS/);
const again = patchTvNativeSources(tvRoot);
assert.deepEqual(again.patched, []);
assert.deepEqual(again.remaining, []);
assert.equal(scanTvNativeSources(tvRoot).some((hit) => hit.includes('AudioRecordingRequester')), false);
assert.equal(scanTvNativeSources(tvRoot).some((hit) => hit.includes('HapticsModule')), false);
assert.equal(readFileSync(new URL('../package.json', import.meta.url), 'utf8'), pkgBefore);
assert.equal(readFileSync(new URL('../package-lock.json', import.meta.url)).equals(lockBefore), true);
rmSync(tvRoot, { recursive: true, force: true });
const headInstalled = path.join(root, 'node_modules/expo-router/ios/ExpoHeadModule.swift');
const phoneEnv = { ...process.env };
delete phoneEnv.EXPO_TV;
delete phoneEnv.EAS_BUILD;
execFileSync('node', ['scripts/eas-tv-preinstall.mjs'], { cwd: root, env: phoneEnv, stdio: 'pipe' });
execFileSync('node', ['scripts/eas-tv-preinstall.mjs', '--check-installed'], { cwd: root, env: phoneEnv, stdio: 'pipe' });
assert.equal(readFileSync(headInstalled, 'utf8').includes('tv-native-patch.cjs'), false);
let tvHookFailed = false;
try {
  execFileSync('node', ['scripts/eas-tv-preinstall.mjs', '--check-installed'], {
    cwd: root,
    env: { ...phoneEnv, EXPO_TV: '1', EAS_BUILD: 'true' },
    stdio: 'pipe',
  });
} catch (error) {
  tvHookFailed = true;
  assert.equal(error.status, 1);
}
assert.equal(tvHookFailed, true, 'le hook TV refuse react-native 0.88 avant de toucher aux sources');
assert.equal(readFileSync(headInstalled, 'utf8').includes('tv-native-patch.cjs'), false);

assert.equal(TVOS_DEPLOYMENT_TARGET, '16.4');
const samplePodfile = `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'Zikru' do
  use_expo_modules!
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
    )
  end
end
`;
const tvPodfile = patchPodfileSource(samplePodfile);
assert.match(tvPodfile, /platform :tvos, '16\.4'/);
assert.equal(tvPodfile.includes("podfile_properties['ios.deploymentTarget']"), false);
assert.equal(tvPodfile.includes('15.1'), false);
assert.match(tvPodfile, /installer\.pods_project\.targets\.each/);
assert.match(tvPodfile, /Gem::Version\.new\('16\.4'\)/);
const twice = patchPodfileSource(tvPodfile);
assert.equal(twice, tvPodfile);
const sampleProject = `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 54;
	objects = {

/* Begin PBXNativeTarget section */
		111111111111111111111101 /* Zikru */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 111111111111111111111201 /* Build configuration list for PBXNativeTarget "Zikru" */;
			buildPhases = (
			);
			buildRules = (
			);
			dependencies = (
			);
			name = Zikru;
			productName = Zikru;
			productType = "com.apple.product-type.application";
		};
		111111111111111111111102 /* Other */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 111111111111111111111202 /* Build configuration list for PBXNativeTarget "Other" */;
			buildPhases = (
			);
			buildRules = (
			);
			dependencies = (
			);
			name = Other;
			productName = Other;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin XCBuildConfiguration section */
		111111111111111111111301 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				PRODUCT_NAME = Zikru;
				TVOS_DEPLOYMENT_TARGET = 15.1;
			};
			name = Debug;
		};
		111111111111111111111302 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				PRODUCT_NAME = Zikru;
				TVOS_DEPLOYMENT_TARGET = 15.1;
			};
			name = Release;
		};
		111111111111111111111303 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				PRODUCT_NAME = Other;
				TVOS_DEPLOYMENT_TARGET = 15.1;
			};
			name = Debug;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		111111111111111111111201 /* Build configuration list for PBXNativeTarget "Zikru" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				111111111111111111111301 /* Debug */,
				111111111111111111111302 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		111111111111111111111202 /* Build configuration list for PBXNativeTarget "Other" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				111111111111111111111303 /* Debug */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Debug;
		};
/* End XCConfigurationList section */
	};
	rootObject = 111111111111111111111401 /* Project object */;
}
`;
const raised = setTargetTvosDeploymentTarget(sampleProject, 'Zikru');
assert.equal((raised.match(/TVOS_DEPLOYMENT_TARGET = 16\.4;/g) || []).length, 2);
assert.equal((raised.match(/ASSETCATALOG_COMPILER_APPICON_NAME = TVAppIcon;/g) || []).length, 2);
assert.match(raised, /TVOS_DEPLOYMENT_TARGET = 15\.1;/);
assert.equal(raised.includes('PRODUCT_NAME = Other'), true);

const { createBrandAssetsAsync } = require('@react-native-tvos/config-tv/build/utils/appleBrandAssets.js');
const { appleTVSourceBrandAssets } = require('@react-native-tvos/config-tv/build/withTVAppleIconImages.js');
const brandRoot = path.join(root, '.tmp-tv-brand');
rmSync(brandRoot, { recursive: true, force: true });
mkdirSync(brandRoot);
const absoluteImages = structuredClone(tvosPlugin[1].appleTVImages);
const toAbsolute = (value) => {
  if (typeof value === 'string') return path.join(root, value);
  for (const key of Object.keys(value)) value[key] = toAbsolute(value[key]);
  return value;
};
toAbsolute(absoluteImages);
const brand = appleTVSourceBrandAssets(absoluteImages);
assert.equal(brand.name, 'TVAppIcon');
await createBrandAssetsAsync(brandRoot, brand);
const catalog = JSON.parse(readFileSync(path.join(brandRoot, 'TVAppIcon.brandassets/Contents.json'), 'utf8'));
assert.deepEqual(
  catalog.assets.map((asset) => `${asset.role} ${asset.size}`).sort(),
  ['primary-app-icon 1280x768', 'primary-app-icon 400x240', 'top-shelf-image 1920x720', 'top-shelf-image-wide 2320x720'].sort(),
);
const homeLayers = JSON.parse(readFileSync(path.join(brandRoot, 'TVAppIcon.brandassets/App Icon - Small.imagestack/Contents.json'), 'utf8'));
assert.deepEqual(homeLayers.layers.map((layer) => layer.filename).sort(), ['Back.imagestacklayer', 'Front.imagestacklayer']);
const storeLayers = JSON.parse(readFileSync(path.join(brandRoot, 'TVAppIcon.brandassets/App Icon - Large.imagestack/Contents.json'), 'utf8'));
assert.deepEqual(storeLayers.layers.map((layer) => layer.filename).sort(), ['Back.imagestacklayer', 'Front.imagestacklayer']);
const wideShelf = JSON.parse(readFileSync(path.join(brandRoot, 'TVAppIcon.brandassets/Top Shelf Image Wide.imageset/Contents.json'), 'utf8'));
assert.deepEqual(wideShelf.images.map((image) => `${image.idiom} ${image.scale}`).sort(), ['tv 1x', 'tv 2x']);
rmSync(brandRoot, { recursive: true, force: true });

function expoConfig(expoTv) {
  const env = { ...process.env };
  if (expoTv) env.EXPO_TV = '1';
  else delete env.EXPO_TV;
  const out = execFileSync('npx', ['expo', 'config', '--json', '--type', 'prebuild'], { cwd: root, env, encoding: 'utf8' });
  return JSON.parse(out);
}
const livePhone = expoConfig(false);
const liveTv = expoConfig(true);
assert.equal(livePhone.slug, 'zikru');
assert.equal(livePhone.owner, 'habib548');
assert.equal(livePhone.version, '1.0.30');
assert.equal(livePhone.extra.eas.projectId, '92e1bb51-c48f-41ed-9131-13a6ed6bdb22');
assert.equal(livePhone.ios.buildNumber, '86');
assert.equal(livePhone.ios.bundleIdentifier, 'com.vibecode.zikru-76mpdv');
assert.equal(liveTv.slug, 'zikru-tv');
assert.equal(liveTv.owner, 'habib548');
assert.equal(liveTv.version, '1.0.30');
assert.equal(liveTv.extra.eas.projectId, '0093f2e3-7828-41e7-9e62-c3e06d9bee77');
assert.equal(liveTv.ios.buildNumber, '7');
assert.equal(liveTv.ios.bundleIdentifier, livePhone.ios.bundleIdentifier);
assert.equal(liveTv.updates, undefined);
assert.deepEqual(liveTv.ios.entitlements, {});
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
