// Tests confidentialité : arrondi des coordonnées, consentements (fail closed), URL météo minimisée,
// cohérence de la politique fr/en/ar, page publique à jour, absence d'affirmations fausses.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLib, policyHtml, PRIVACY_HTML_PATH } from './privacy-html.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const storageStub = 'export async function loadJSON(k, f) { return f; } export async function saveJSON() { return true; } export async function saveCacheJSON() {}';
const dir = await loadLib(['privacy', 'privacy-policy', 'privacy-text', 'prayer', 'weather'], { storage: storageStub });
const P = await import(join(dir, 'privacy.mjs'));
const W = await import(join(dir, 'weather.mjs'));
const { POLICY } = await import(join(dir, 'privacy-policy.mjs'));
const { PRIVACY_TEXT } = await import(join(dir, 'privacy-text.mjs'));
let ok = 0;
const CONTACT = 'mohamadalhabib@live.com';
const test = async (n, f) => { await f(); ok++; console.log('✓', n); };

await test('coarse : arrondi au dixième de degré, sans artefacts', () => {
  assert.equal(P.coarse(46.53627), 46.5);
  assert.equal(P.coarse(6.60312), 6.6);
  assert.equal(P.coarse(-17.4677), -17.5);
  assert.equal(P.coarse(-0.04), 0);
  assert.equal(P.coarse(NaN), 0);
  assert.deepEqual(P.coarsePoint(47.3769, 8.5417), { lat: 47.4, lng: 8.5 });
  for (let i = 0; i < 500; i++) {
    const x = (Math.random() - 0.5) * 360;
    const c = P.coarse(x);
    assert.ok(Math.abs(c - x) <= 0.05 + 1e-9);
    assert.ok((String(c).split('.')[1]?.length ?? 0) <= 1, `trop de décimales : ${c}`);
  }
});

await test('URL météo : uniquement des coordonnées arrondies (≈ 11 km)', () => {
  const u = new URL(W.weatherUrl(46.53627, 6.60312));
  assert.equal(u.hostname, 'api.open-meteo.com');
  assert.equal(u.searchParams.get('latitude'), '46.5');
  assert.equal(u.searchParams.get('longitude'), '6.6');
  assert.ok(!W.weatherUrl(46.53627, 6.60312).includes('46.536'));
});

await test('getWeather : envoie la position arrondie, nom de ville calculé localement, aucun géocodage distant', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ current: { temperature_2m: 10, weather_code: 0, is_day: 1, wind_speed_10m: 3 }, daily: {} }) };
  };
  const w = await W.getWeather(46.5363, 6.6031, 'GPS 46.54, 6.60', true);
  assert.equal(calls.length, 1, 'un seul appel réseau (Open-Meteo)');
  assert.match(calls[0], /latitude=46\.5&longitude=6\.6&/);
  assert.equal(w.city, 'Prilly');
  const w2 = await W.getWeather(46.2044, 6.1432, 'Genève', true);
  assert.equal(w2.city, 'Genève');
  assert.ok(calls.every((c) => c.startsWith('https://api.open-meteo.com/')));
});

await test('consentements : rien n’est permis par défaut ni avant chargement (fail closed)', () => {
  const d = P.DEFAULT_CONSENT;
  for (const k of ['ai', 'weather', 'account']) {
    assert.equal(P.allows(d, k), false);
    assert.equal(P.undecided(d, k), true);
  }
  assert.equal(P.canSendToAI(d, true), false);
  assert.equal(P.canFetchWeather(d, true), false);
  const yes = P.decide(P.decide(d, 'ai', true), 'weather', true);
  assert.equal(P.canSendToAI(yes, false), false, 'stockage non chargé → refus');
  assert.equal(P.canSendToAI(yes, true), true);
  assert.equal(P.canFetchWeather(yes, true), true);
  assert.equal(P.canSendToAI(P.decide(yes, 'ai', false), true), false, 'retrait du consentement');
  assert.equal(P.undecided(P.decide(d, 'ai', false), 'ai'), false);
  assert.ok(yes.at.ai && !Number.isNaN(Date.parse(yes.at.ai)));
  assert.equal(d.ai, null, 'decide ne mute pas');
});

await test('normalizeConsent : valeurs corrompues ou anciennes → tout refusé', () => {
  for (const raw of [null, undefined, 'x', 42, {}, { v: 0, ai: true }, { v: P.CONSENT_VERSION, ai: 'yes', weather: 1 }]) {
    const c = P.normalizeConsent(raw);
    assert.equal(P.allows(c, 'ai'), false);
    assert.equal(P.allows(c, 'weather'), false);
  }
  const c = P.normalizeConsent({ v: P.CONSENT_VERSION, ai: true, weather: false, account: null, at: { ai: '2026-10-29T10:00:00.000Z' } });
  assert.equal(P.allows(c, 'ai'), true);
  assert.equal(c.weather, false);
});

await test('nearestCityLabel / policyLang', () => {
  assert.equal(P.nearestCityLabel({ lat: 46.52, lng: 6.63 }, [{ label: 'Lausanne', lat: 46.5197, lng: 6.6323 }]), 'Lausanne');
  assert.equal(P.nearestCityLabel({ lat: 40, lng: 0 }, [{ label: 'Lausanne', lat: 46.5197, lng: 6.6323 }]), null);
  assert.equal(P.policyLang('ar'), 'ar');
  assert.equal(P.policyLang('de-CH'), 'en');
  assert.equal(P.policyLang('wo'), 'fr');
});

await test('politique : mêmes sections en fr/en/ar, chaque flux nommé', () => {
  const ids = POLICY.fr.sections.map((s) => s.id);
  for (const l of ['en', 'ar']) assert.deepEqual(POLICY[l].sections.map((s) => s.id), ids, l);
  for (const l of ['fr', 'en', 'ar']) {
    const all = JSON.stringify(POLICY[l]);
    for (const must of ['Open-Meteo', 'Anthropic', 'Supabase', 'eu-central-2', 'GitHub Pages', 'api.alquran.cloud', 'api.quran.com', 'everyayah.com', 'mp3quran.net', 'Prilly', 'edoeb.admin.ch']) assert.ok(all.includes(must), `${l} : ${must} manquant`);
  }
  for (const l of ['fr', 'en', 'ar']) {
    const t = PRIVACY_TEXT[l];
    assert.equal(t.ai_points.length, PRIVACY_TEXT.fr.ai_points.length);
    assert.ok(JSON.stringify(t).includes('Anthropic') && JSON.stringify(t).includes('Open-Meteo'));
  }
});

await test('page publique public/privacy/index.html à jour (npm run privacy:html)', async () => {
  assert.equal(readFileSync(PRIVACY_HTML_PATH, 'utf8'), await policyHtml(), 'régénérer avec npm run privacy:html');
});

await test('aucune affirmation fausse restante (« aucune donnée envoyée »), aucun géocodage distant', () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|json|html|md)$/.test(f)) files.push(p); } };
  walk(join(root, 'src'));
  walk(join(root, 'public'));
  files.push(join(root, 'app.json'));
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/envoyée à aucun serveur|ne collecte aucune donnée|données stockées uniquement sur cet appareil/i.test(s), `affirmation fausse dans ${f}`);
    assert.ok(!/api-bdc\.net|bigdatacloud/i.test(s), `géocodage distant dans ${f}`);
  }
});

await test('gating : Bilal et la météo ne partent qu’avec consentement (vérification statique)', () => {
  const bilal = readFileSync(join(root, 'src/app/bilal.tsx'), 'utf8');
  assert.match(bilal, /canSendToAI\(consent, consentReady\)/);
  assert.match(bilal, /if \(!t \|\| busy \|\| !allowed\) return;/);
  const home = readFileSync(join(root, 'src/app/(tabs)/index.tsx'), 'utf8');
  assert.match(home, /if \(!weatherOk\) \{/);
  assert.match(home, /aiUnavailable \|\| aiBusy \|\| !aiOk/);
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  assert.equal(app.ios.privacyManifests.NSPrivacyTracking, false);
  assert.ok(app.ios.privacyManifests.NSPrivacyCollectedDataTypes.length >= 4, 'manifeste de confidentialité iOS renseigné');
  assert.ok(app.ios.privacyManifests.NSPrivacyCollectedDataTypes.every((d) => d.NSPrivacyCollectedDataTypeTracking === false));
});

await test('contact protection des données publié (fr/en/ar, page publique, assistance)', () => {
  for (const l of ['fr', 'en', 'ar']) {
    const all = JSON.stringify(POLICY[l]);
    assert.ok(all.split(CONTACT).length - 1 >= 2, `${l} : contact en section 1 et dans les droits`);
  }
  assert.ok(readFileSync(PRIVACY_HTML_PATH, 'utf8').includes(CONTACT));
  assert.ok(readFileSync(join(root, 'public/support/index.html'), 'utf8').includes(CONTACT));
});

console.log(`\n${ok} tests confidentialité OK`);
