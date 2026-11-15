/**
 * Correctifs natifs Apple TV, appliqués seulement par le hook EAS et le plugin
 * Podfile quand EXPO_TV=1. Le dépôt et le lockfile iPhone ne changent pas :
 * on réécrit des fichiers sous node_modules après l’installation TV.
 *
 * expo-router déclare tvOS via le podspec, puis compile ExpoHead, qui appelle
 * CoreSpotlight et des propriétés NSUserActivity absentes de tvOS.
 * expo-file-system importe Photos, lui aussi absent de tvOS.
 */
const fs = require('fs');
const path = require('path');
const { TV_AUTOLINK_EXCLUDE } = require('./tv-native.cjs');

const MARK_SPOTLIGHT = 'tvOS: CoreSpotlight is unavailable. Patched by scripts/tv-native-patch.cjs';
const MARK_PHOTOS = 'tvOS: Photos is unavailable. Patched by scripts/tv-native-patch.cjs';

const TV_HEAD_STUB = `public class ExpoHeadModule: Module {
  private var activities: [String: NSUserActivity] = [:]

  public required init(appContext: AppContext) {
    super.init(appContext: appContext)
  }

  public func definition() -> ModuleDefinition {
    Name("ExpoHead")

    Constant("activities") {
      [
        "INDEXED_ROUTE": indexRouteTag
      ]
    }

    Function("getLaunchActivity") { () -> [String: Any]? in
      guard let activity = launchedActivity else {
        return nil
      }
      return [
        "activityType": activity.activityType,
        "id": activity.targetContentIdentifier as Any,
        "isEligibleForHandoff": activity.isEligibleForHandoff,
        "isEligibleForPublicIndexing": activity.isEligibleForPublicIndexing,
        "isEligibleForSearch": activity.isEligibleForSearch,
        "title": activity.title as Any,
        "webpageURL": activity.webpageURL as Any,
        "keywords": activity.keywords as Any,
        "userInfo": activity.userInfo as Any,
      ]
    }

    Function("createActivity") { (value: MetadataOptions) in
      if let webpageUrl = value.webpageURL {
        if webpageUrl.absoluteString.starts(with: "file://") == true {
          throw Exception(
            name: "Invalid webpageUrl",
            description:
              "Scheme file:// is not allowed for location origin (webpageUrl in NSUserActivity). URL: \\(webpageUrl.absoluteString)"
          )
        }
      }
      let activity = self.createOrUpdateActivity(value: value)
      activity.becomeCurrent()
    }

    AsyncFunction("clearActivitiesAsync") { (ids: [String], promise: Promise) in
      for id in ids {
        self.revokeActivity(id: id)
      }
      promise.resolve()
    }

    Function("suspendActivity") { (id: String) in
      self.activities[id]?.resignCurrent()
    }

    Function("revokeActivity") { (id: String) in
      self.revokeActivity(id: id)
    }
  }

  func createOrUpdateActivity(value: MetadataOptions) -> NSUserActivity {
    let key = value.id ?? ""
    let existing = self.activities[key]
    let activity = existing ?? NSUserActivity(activityType: value.activityType)
    if existing == nil {
      self.activities[key] = activity
    }
    activity.targetContentIdentifier = value.id
    activity.isEligibleForHandoff = value.isEligibleForHandoff
    activity.isEligibleForPublicIndexing = value.isEligibleForPublicIndexing
    activity.isEligibleForSearch = value.isEligibleForSearch
    activity.title = value.title
    if let keywords = value.keywords {
      activity.keywords = Set(keywords)
    }
    activity.userInfo = value.userInfo
    if value.webpageURL != nil {
      activity.webpageURL = value.webpageURL
    }
    return activity
  }

  @discardableResult
  func revokeActivity(id: String) -> NSUserActivity? {
    let activity = self.activities.removeValue(forKey: id)
    activity?.invalidate()
    return activity
  }
}
`;

function patchExpoHeadModuleSource(src) {
  if (src.includes(MARK_SPOTLIGHT)) return src;
  const imports = 'import CoreSpotlight\nimport ExpoModulesCore\nimport MobileCoreServices\n';
  if (!src.includes(imports)) {
    throw new Error('tv-native-patch: ExpoHeadModule.swift import block changed; refusing to guess');
  }
  const anchor = 'public class ExpoHeadModule: Module {';
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error('tv-native-patch: ExpoHeadModule class anchor missing');
  const next = src.replace(
    imports,
    `#if !os(tvOS)\nimport CoreSpotlight\nimport MobileCoreServices\n#endif\nimport ExpoModulesCore\n// ${MARK_SPOTLIGHT}\n`,
  );
  const classAt = next.indexOf(anchor);
  const patched = `${next.slice(0, classAt)}#if !os(tvOS)\n${next.slice(classAt).replace(/\s*$/, '\n')}#else\n${TV_HEAD_STUB}#endif\n`;
  assertSwiftConditionals(patched, 'ExpoHeadModule.swift');
  return patched;
}

/**
 * Swift parses `#if` as syntax, not as a C preprocessor. An `else` that is the
 * first token of a branch is not a statement, so `} \n #if \n else if` is
 * "Expected expression" on every platform, including the inactive tvOS branch.
 * Each branch must be a finished statement.
 */
function assertSwiftConditionals(src, label) {
  const lines = src.split('\n');
  let depth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('#if')) depth += 1;
    if (trimmed.startsWith('#endif')) {
      depth -= 1;
      if (depth < 0) throw new Error(`${label}:${i + 1} extra #endif`);
    }
    if (!trimmed.startsWith('#if') && !trimmed.startsWith('#elseif') && !trimmed.startsWith('#else')) continue;
    let next = '';
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j].trim();
      if (!candidate || candidate.startsWith('//')) continue;
      next = candidate;
      break;
    }
    if (/^else\b/.test(next)) {
      throw new Error(`${label}:${i + 1} #if branch starts with "${next}", which is not a statement`);
    }
  }
  if (depth !== 0) throw new Error(`${label}: unbalanced #if (${depth})`);
}

function patchExpoHeadSubscriberSource(src) {
  if (src.includes(MARK_SPOTLIGHT)) {
    assertSwiftConditionals(src, 'ExpoHeadAppDelegateSubscriber.swift');
    return src;
  }
  const imports = 'import CoreSpotlight\nimport ExpoModulesCore\n';
  if (!src.includes(imports)) {
    throw new Error('tv-native-patch: ExpoHeadAppDelegateSubscriber.swift import block changed; refusing to guess');
  }
  let next = src.replace(
    imports,
    `#if !os(tvOS)\nimport CoreSpotlight\n#endif\nimport ExpoModulesCore\n// ${MARK_SPOTLIGHT}\n`,
  );
  const startNeedle = '    if let wellKnownHref = userActivity.userInfo?["href"] as? String {';
  const start = next.indexOf(startNeedle);
  const end = next.indexOf('\n    return false', start);
  if (start < 0 || end < 0) throw new Error('tv-native-patch: subscriber if/return anchors missing');
  const originalIf = next.slice(start, end).replace(/\s+$/, '\n');
  if (!originalIf.includes('} else if userActivity.activityType == CSQueryContinuationActionType {')) {
    throw new Error('tv-native-patch: Spotlight continuation branch missing');
  }
  const tvIf = `    if let wellKnownHref = userActivity.userInfo?["href"] as? String {
      // From a stored NSUserActivity, e.g. Quick Note or Siri Reminder
      // From other native device to app
      sendFakeDeepLinkEventToReactNative(obj: self, url: prefixDeepLink(fragment: wellKnownHref))
    }
`;
  next = `${next.slice(0, start)}#if !os(tvOS)\n${originalIf}#else\n${tvIf}#endif\n${next.slice(end + 1)}`;
  assertSwiftConditionals(next, 'ExpoHeadAppDelegateSubscriber.swift');
  return next;
}

function patchFileSystemHelpersSource(src) {
  if (src.includes(MARK_PHOTOS)) return src;
  if (!src.includes('import Photos\n')) {
    throw new Error('tv-native-patch: FileSystemHelpers.swift has no Photos import');
  }
  const start = src.indexOf('internal func copyPHAsset(');
  if (start < 0) throw new Error('tv-native-patch: copyPHAsset anchor missing');
  const head = src.slice(0, start).replace('import Photos\n', `#if !os(tvOS)\nimport Photos\n#endif\n// ${MARK_PHOTOS}\n`);
  const body = src.slice(start).replace(/\s*$/, '\n');
  const patched = `${head}#if !os(tvOS)\n${body}#else\ninternal func copyPHAsset(fromUrl: URL, toUrl: URL, promise: Promise) {\n  promise.reject(FailedToCopyAssetException(fromUrl.absoluteString))\n}\n#endif\n`;
  assertSwiftConditionals(patched, 'FileSystemHelpers.swift');
  return patched;
}

function patchFileSystemLegacySource(src) {
  if (src.includes(MARK_PHOTOS)) return src;
  if (!src.includes('import Photos\n')) {
    throw new Error('tv-native-patch: FileSystemLegacyModule.swift has no Photos import');
  }
  const property = 'private lazy var resourceManager = PHAssetResourceManager()';
  const call = 'copyPHAsset(fromUrl: fromUrl, toUrl: toUrl, with: resourceManager, promise: promise)';
  if (!src.includes(property) || !src.includes(call)) {
    throw new Error('tv-native-patch: FileSystemLegacyModule.swift Photos anchors missing');
  }
  let next = src.replace('import Photos\n', `#if !os(tvOS)\nimport Photos\n#endif\n// ${MARK_PHOTOS}\n`);
  next = next.replace(`${property}\n`, `#if !os(tvOS)\n  ${property}\n#endif\n`);
  const lines = next.split('\n');
  const index = lines.findIndex((line) => line.includes(call));
  if (index < 0) throw new Error('tv-native-patch: copyPHAsset call missing after import rewrite');
  const indent = lines[index].match(/^\s*/)[0];
  lines.splice(
    index,
    1,
    '#if !os(tvOS)',
    `${indent}${call}`,
    '#else',
    `${indent}copyPHAsset(fromUrl: fromUrl, toUrl: toUrl, promise: promise)`,
    '#endif',
  );
  const patched = lines.join('\n');
  assertSwiftConditionals(patched, 'FileSystemLegacyModule.swift');
  return patched;
}

function patchAssetLibrarySource(src) {
  if (src.includes(MARK_PHOTOS)) return src;
  const header = '#import <Photos/Photos.h>\n';
  const impl = '@implementation EXFileSystemAssetLibraryHandler\n';
  if (!src.includes(header) || !src.includes(impl) || !src.trimEnd().endsWith('@end')) {
    throw new Error('tv-native-patch: EXFileSystemAssetLibraryHandler.m anchors missing');
  }
  let next = src.replace(header, `#if !TARGET_OS_TV\n${header}#endif\n// ${MARK_PHOTOS}\n`);
  next = next.replace(impl, `${impl}#if !TARGET_OS_TV\n`);
  const endAt = next.lastIndexOf('@end');
  const stub = `#else
+ (void)getInfoForFile:(NSURL *)fileUri
           withOptions:(NSDictionary *)options
              resolver:(EXPromiseResolveBlock)resolve
              rejecter:(EXPromiseRejectBlock)reject
{
  reject(@"E_UNSUPPORTED", @"The photo library is not available on tvOS.", nil);
}

+ (void)copyFrom:(NSURL *)from
              to:(NSURL *)to
        resolver:(EXPromiseResolveBlock)resolve
        rejecter:(EXPromiseRejectBlock)reject
{
  reject(@"E_UNSUPPORTED", @"The photo library is not available on tvOS.", nil);
}
#endif
`;
  return `${next.slice(0, endAt)}${stub}${next.slice(endAt)}`;
}

function patchExpoRouterPodspecSource(src) {
  let next = src;
  if (!next.includes(":tvos => '16.4'")) {
    const from = "s.platforms      = {\n    :ios => '16.4'\n  }";
    if (!next.includes(from)) {
      throw new Error('tv-native-patch: ExpoRouter.podspec platform block changed');
    }
    next = next.replace(from, "s.platforms      = {\n    :ios => '16.4',\n    :tvos => '16.4'\n  }");
  }
  if (!next.includes('s.tvos.exclude_files')) {
    const from = "s.exclude_files = 'Tests/**/*'";
    if (!next.includes(from)) throw new Error('tv-native-patch: ExpoRouter.podspec exclude_files anchor missing');
    next = next.replace(from, "s.exclude_files = 'Tests/**/*'\n  s.tvos.exclude_files = 'LinkPreview/**/*', 'Toolbar/**/*'");
  }
  return next;
}

const SOURCE_PATCHES = [
  ['node_modules/expo-router/ios/ExpoHeadModule.swift', patchExpoHeadModuleSource],
  ['node_modules/expo-router/ios/ExpoHeadAppDelegateSubscriber.swift', patchExpoHeadSubscriberSource],
  ['node_modules/expo-router/ios/ExpoRouter.podspec', patchExpoRouterPodspecSource],
  ['node_modules/expo-file-system/ios/Legacy/FileSystemHelpers.swift', patchFileSystemHelpersSource],
  ['node_modules/expo-file-system/ios/Legacy/FileSystemLegacyModule.swift', patchFileSystemLegacySource],
  ['node_modules/expo-file-system/ios/Legacy/EXFileSystemAssetLibraryHandler.m', patchAssetLibrarySource],
];

function writeIfChanged(file, next) {
  const prev = fs.readFileSync(file, 'utf8');
  if (prev === next) return false;
  fs.writeFileSync(file, next);
  return true;
}

function patchTvNativeSources(root) {
  const patched = [];
  for (const [rel, fn] of SOURCE_PATCHES) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const next = fn(fs.readFileSync(file, 'utf8'));
    if (writeIfChanged(file, next)) patched.push(rel);
  }
  patched.push(...patchTvModuleConfigs(root));
  const remaining = scanTvNativeSources(root);
  return { patched, remaining };
}

const PROVIDER_FIELDS = ['modules', 'appDelegateSubscribers', 'reactDelegateHandlers'];

function classNameOf(entry) {
  return typeof entry === 'string' ? entry : entry?.class;
}

/** The generated provider lists every class in expo-module.config.json. A class whose Swift is excluded or inside `#if os(iOS)` is not in the tvOS module. */
function classCompiledForTv(pkgDir, className, extraGlobs = []) {
  const globs = [...tvosExcludeGlobsFromDir(pkgDir), ...extraGlobs].map(globToRegExp);
  const re = new RegExp(`\\b(?:class|@interface|@implementation)\\s+${className}\\b`);
  let sawExcluded = false;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (['node_modules', 'android', 'tests', 'Tests', 'example', 'templates'].includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const found = walk(full);
        if (found) return true;
        continue;
      }
      if (!/\.(swift|m|mm|h)$/.test(entry.name)) continue;
      const rel = path.relative(pkgDir, full);
      if (globs.some((pattern) => pattern.test(rel) || pattern.test(entry.name))) {
        sawExcluded = true;
        continue;
      }
      const raw = fs.readFileSync(full, 'utf8');
      if (!re.test(raw)) {
        re.lastIndex = 0;
        continue;
      }
      re.lastIndex = 0;
      if (re.test(compiledFor(raw, 'tvos'))) return true;
      re.lastIndex = 0;
    }
    return false;
  };
  return walk(pkgDir) === true;
}

function tvosExcludeGlobsFromDir(pkgDir) {
  const globs = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'android') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.podspec') && /tvos/i.test(fs.readFileSync(full, 'utf8'))) {
        globs.push(...tvosExcludeGlobs(fs.readFileSync(full, 'utf8')));
      }
    }
  };
  if (fs.existsSync(pkgDir)) walk(pkgDir);
  return globs;
}

function patchAppleModuleConfig(config, missing) {
  const key = config.apple ? 'apple' : config.ios ? 'ios' : null;
  if (!key) return config;
  const next = structuredClone(config);
  const section = next[key];
  let changed = false;
  for (const field of PROVIDER_FIELDS) {
    if (!Array.isArray(section[field])) continue;
    const filtered = section[field].filter((entry) => !missing.has(classNameOf(entry)));
    if (filtered.length !== section[field].length) {
      section[field] = filtered;
      changed = true;
    }
  }
  return changed ? next : config;
}

function patchTvModuleConfigs(root) {
  const patched = [];
  for (const pkg of listPackageDirs(root)) {
    if (TV_AUTOLINK_EXCLUDE.includes(pkg.name)) continue;
    const configPath = path.join(pkg.dir, 'expo-module.config.json');
    if (!fs.existsSync(configPath)) continue;
    if (!packageDeclaresTvOS(pkg.dir)) continue;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const section = config.apple || config.ios;
    if (!section) continue;
    const names = PROVIDER_FIELDS.flatMap((field) => (section[field] || []).map(classNameOf)).filter(Boolean);
    const missing = new Set(names.filter((name) => !classCompiledForTv(pkg.dir, name)));
    if (missing.size === 0) continue;
    const next = patchAppleModuleConfig(config, missing);
    const text = `${JSON.stringify(next, null, 2)}\n`;
    if (writeIfChanged(configPath, text)) patched.push(path.relative(root, configPath));
  }
  return patched;
}

function conditionIncludes(cond, os) {
  let expr = cond.trim();
  if (!expr) return true;
  expr = expr.replace(/!\s*os\(\s*tvOS\s*\)/g, os === 'tvos' ? 'false' : 'true');
  expr = expr.replace(/os\(\s*tvOS\s*\)/g, os === 'tvos' ? 'true' : 'false');
  expr = expr.replace(/os\(\s*iOS\s*\)/g, os === 'ios' ? 'true' : 'false');
  expr = expr.replace(/os\(\s*macOS\s*\)/g, 'false');
  expr = expr.replace(/!\s*TARGET_OS_TV\b/g, os === 'tvos' ? 'false' : 'true');
  expr = expr.replace(/\bTARGET_OS_TV\b/g, os === 'tvos' ? 'true' : 'false');
  expr = expr.replace(/\bTARGET_OS_IOS\b/g, os === 'ios' ? 'true' : 'false');
  expr = expr.replace(/\bTARGET_OS_(MACCATALYST|OSX|VISION|WATCH)\b/g, 'false');
  if (/[A-Za-z_]/.test(expr.replace(/true|false/g, ''))) return true;
  try {
    return Function(`"use strict"; return (${expr});`)();
  } catch {
    return true;
  }
}

/** Garde le texte que le compilateur voit pour tvOS ou iOS. */
function compiledFor(source, os) {
  const out = [];
  const stack = [];
  const parentOn = () => stack.every((frame) => frame.active);
  for (const line of source.split('\n')) {
    const s = line.trim();
    if (s.startsWith('#if')) {
      const active = parentOn() && conditionIncludes(s.replace(/^#if/, ''), os);
      stack.push({ active, taken: active });
      continue;
    }
    if (s.startsWith('#elseif') || s.startsWith('#elif')) {
      const frame = stack.pop() || { taken: false };
      const active = parentOn() && !frame.taken && conditionIncludes(s.replace(/^#else?if|^#elif/, ''), os);
      stack.push({ active, taken: frame.taken || active });
      continue;
    }
    if (s.startsWith('#else')) {
      const frame = stack.pop() || { taken: false };
      const active = parentOn() && !frame.taken;
      stack.push({ active, taken: true });
      continue;
    }
    if (s.startsWith('#endif')) {
      stack.pop();
      continue;
    }
    if (parentOn()) out.push(line);
  }
  return out.join('\n');
}

const BANNED = [
  { re: /\bCSSearchable\w*/ },
  { re: /\bCSQueryContinuationActionType\b/ },
  { re: /\bCSSearchQueryString\b/ },
  { re: /\.persistentIdentifier\b/ },
  { re: /\.isEligibleForPrediction\b/ },
  { re: /\.contentAttributeSet\b/ },
  { re: /\.domainIdentifier\b/ },
  { re: /\bimport CoreSpotlight\b/ },
  { re: /\bimport MobileCoreServices\b/ },
  { re: /\bimport Photos\b/ },
  { re: /#import <Photos\// },
  { re: /\bPHPhotoLibrary\b/ },
  { re: /\bPHAsset\b/ },
  { re: /\bUIPasteboard\b/ },
  { re: /\bUIImpactFeedbackGenerator\b/ },
  { re: /\bUINotificationFeedbackGenerator\b/ },
  { re: /\bUISelectionFeedbackGenerator\b/ },
  { re: /\bCHHapticEngine\b/ },
  { re: /\bimport CoreHaptics\b/ },
  { re: /\bHKHealthStore\b/ },
  { re: /\bimport HealthKit\b/ },
  { re: /\bNFCNDEFReaderSession\b/ },
  { re: /\bimport CoreNFC\b/ },
  { re: /\bCXProvider\b/ },
  { re: /\bimport CallKit\b/ },
  { re: /\bWidgetCenter\b/ },
  { re: /\bimport WidgetKit\b/ },
  { re: /\bimport CoreTelephony\b/ },
  { re: /#import <CoreTelephony\// },
  { re: /\bimport CoreBluetooth\b/ },
  { re: /\bCBCentralManager\b/ },
  { re: /\brecordPermission\b/ },
];

function tvosExcludeGlobs(podspec) {
  const match = podspec.match(/\.tvos\.exclude_files\s*=\s*([\s\S]*?)(?:\n\s*\n|\n\s*[a-z]\.|\nend\b)/);
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
}

function globToRegExp(glob) {
  let body = '';
  for (let i = 0; i < glob.length; i += 1) {
    if (glob.startsWith('**/', i)) {
      body += '(?:.*/)?';
      i += 2;
      continue;
    }
    if (glob.startsWith('**', i)) {
      body += '.*';
      i += 1;
      continue;
    }
    if (glob[i] === '*') {
      body += '[^/]*';
      continue;
    }
    body += /[.+^${}()|[\]\\]/.test(glob[i]) ? `\\${glob[i]}` : glob[i];
  }
  return new RegExp(`(?:^|/)${body}$`);
}

function listPackageDirs(root) {
  const modules = path.join(root, 'node_modules');
  if (!fs.existsSync(modules)) return [];
  const dirs = [];
  for (const name of fs.readdirSync(modules)) {
    if (name === '.bin' || name.startsWith('.')) continue;
    const full = path.join(modules, name);
    if (!fs.statSync(full).isDirectory()) continue;
    if (name.startsWith('@')) {
      for (const child of fs.readdirSync(full)) {
        const nested = path.join(full, child);
        if (fs.statSync(nested).isDirectory()) dirs.push({ name: `${name}/${child}`, dir: nested });
      }
    } else {
      dirs.push({ name, dir: full });
    }
  }
  return dirs;
}

function podspecExcludesTvOS(dir) {
  const globs = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'android' || entry.name === 'tests' || entry.name === 'Tests') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.podspec')) {
        const text = fs.readFileSync(full, 'utf8');
        if (!/tvos/i.test(text)) continue;
        globs.push(...tvosExcludeGlobs(text).map(globToRegExp));
      }
    }
  };
  walk(dir);
  return globs;
}

function packageDeclaresTvOS(dir) {
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'android') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (walk(full)) return true;
      } else if (entry.name.endsWith('.podspec') && /tvos/i.test(fs.readFileSync(full, 'utf8'))) {
        return true;
      }
    }
    return false;
  };
  return walk(dir);
}

function scanPackage(dir, relRoot) {
  const excludes = podspecExcludesTvOS(dir);
  const hits = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'android' || entry.name === 'tests' || entry.name === 'Tests' || entry.name === 'example' || entry.name === 'templates') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(swift|m|mm|h)$/.test(entry.name)) continue;
      const rel = path.relative(relRoot, full);
      if (excludes.some((re) => re.test(rel) || re.test(entry.name) || re.test(path.relative(dir, full)))) continue;
      const raw = fs.readFileSync(full, 'utf8');
      const tv = compiledFor(raw, 'tvos');
      const lines = tv.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        for (const ban of BANNED) {
          if (ban.re.test(line)) {
            ban.re.lastIndex = 0;
            hits.push(`${rel}:${index + 1}: ${trimmed.slice(0, 160)}`);
            return;
          }
          ban.re.lastIndex = 0;
        }
      });
    }
  };
  walk(dir);
  return hits;
}

function scanTvNativeSources(root) {
  const hits = [];
  for (const pkg of listPackageDirs(root)) {
    if (TV_AUTOLINK_EXCLUDE.includes(pkg.name)) continue;
    // Le cœur React Native est le fork tvOS sur EAS et le paquet iPhone en local.
    // Le build 385c00e l’a déjà compilé ; le dossier s’appelle toujours react-native.
    if (pkg.name === 'react-native' || pkg.name === 'hermes-engine') continue;
    if (!packageDeclaresTvOS(pkg.dir)) continue;
    hits.push(...scanPackage(pkg.dir, root));
  }
  return hits;
}

module.exports = {
  MARK_PHOTOS,
  MARK_SPOTLIGHT,
  compiledFor,
  patchAssetLibrarySource,
  patchExpoHeadModuleSource,
  patchExpoHeadSubscriberSource,
  patchExpoRouterPodspecSource,
  patchFileSystemHelpersSource,
  patchFileSystemLegacySource,
  patchTvNativeSources,
  scanTvNativeSources,
};
