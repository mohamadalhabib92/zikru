// Voix d’adhan : licences, emplacements locaux vides, son de notification < 30 s, chaînes au catalogue.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLib } from './load-lib.mjs';

const { 'adhan-voices': V, 'ui-strings': U } = await loadLib(['adhan-voices', 'ui-strings'], 'adhan');

const published = V.assembleAdhanVoices({}, null);
assert.equal(published.length, 5);
const ids = new Set();
for (const v of published) {
  assert.equal(v.kind, 'published');
  assert.equal(ids.has(v.id), false);
  ids.add(v.id);
  assert.equal(typeof v.source, 'object');
  assert.ok(v.source.uri.startsWith('https://upload.wikimedia.org/wikipedia/commons/'), v.id);
  assert.ok(v.pageUrl.startsWith('https://commons.wikimedia.org/wiki/File:'), v.id);
  assert.ok(v.license && v.licenseUrl.startsWith('https://creativecommons.org/'), v.id);
  assert.ok(v.reciter, v.id);
  assert.equal(v.source.uri.includes('YOUR_'), false);
}
assert.equal(V.resolveAdhanVoice(undefined, published).id, V.DEFAULT_ADHAN_VOICE_ID);
assert.equal(V.resolveAdhanVoice('inconnu', published).id, V.DEFAULT_ADHAN_VOICE_ID);
assert.equal(V.resolveAdhanVoice('commons-jarih', published).reciter, 'Jarih');
assert.equal(V.ADHAN_CUE.pageUrl, published.find((v) => v.id === 'commons-jarih').pageUrl);

const locals = V.assembleAdhanVoices({ 'local-bilal': 7, 'local-makkah': null }, null);
assert.equal(locals[0].id, 'local-bilal');
assert.equal(locals[0].kind, 'local');
assert.equal(locals[0].source, 7);
assert.equal(locals.some((v) => v.id === 'local-makkah'), false);
assert.equal(locals.some((v) => v.id === 'local-madinah'), false);

assert.equal(V.assembleAdhanVoices({}, 'YOUR_ADHAN_AUDIO_URL').some((v) => v.kind === 'custom'), false);
assert.equal(V.assembleAdhanVoices({}, '  ').some((v) => v.kind === 'custom'), false);
const custom = V.assembleAdhanVoices({}, 'https://example.com/adhan.mp3');
assert.equal(custom.at(-1).id, 'custom-url');
assert.equal(custom.at(-1).kind, 'custom');

assert.equal(V.payloadPlaysAdhan({ playsAdhan: '1' }), true);
assert.equal(V.payloadPlaysAdhan({ playsAdhan: true }), true);
assert.equal(V.payloadPlaysAdhan({ playsAdhan: '0' }), false);
assert.equal(V.payloadPlaysAdhan({ playsAdhan: false }), false);
assert.equal(V.payloadPlaysAdhan(null), false);
assert.equal(V.payloadPlaysAdhan({ kind: 'friday' }), false);
const now = 1_700_000_000_000;
assert.equal(V.adhanResponseIsFresh(now - 10_000, now), true);
assert.equal(V.adhanResponseIsFresh(now - 10 * 60_000, now), false);
assert.equal(V.adhanResponseIsFresh((now - 5_000) / 1000, now), true);
assert.equal(V.adhanResponseIsFresh(undefined, now), false);

for (const s of V.adhanUiStrings()) assert.ok(s in U.UI_STRINGS, 'catalogue manquant : ' + s);

const wav = readFileSync(new URL('../assets/audio/adhan_cue.wav', import.meta.url));
assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
let o = 12;
let rate = 0, ch = 0, bits = 0, data = 0;
while (o + 8 <= wav.length) {
  const id = wav.toString('ascii', o, o + 4);
  const size = wav.readUInt32LE(o + 4);
  if (id === 'fmt ') {
    ch = wav.readUInt16LE(o + 10);
    rate = wav.readUInt32LE(o + 12);
    bits = wav.readUInt16LE(o + 22);
  } else if (id === 'data') {
    data = size;
    break;
  }
  o += 8 + size + (size % 2);
}
const seconds = data / (rate * ch * (bits / 8));
assert.ok(seconds > 20 && seconds < 30, 'durée du son de notification : ' + seconds);
assert.equal(V.ADHAN_CUE.sound, 'adhan_cue.wav');
const lic = readFileSync(new URL('../assets/audio/adhan_cue.LICENSE.txt', import.meta.url), 'utf8');
assert.ok(lic.includes('Jarih') && lic.includes('CC BY-SA 3.0') && lic.includes('https://commons.wikimedia.org/wiki/File:Adhan_wiki.oga'));
const app = readFileSync(new URL('../app.json', import.meta.url), 'utf8');
assert.ok(app.includes('./assets/audio/adhan_cue.wav'));

console.log('adhan voices OK (' + published.length + ' publiées, son ' + seconds.toFixed(1) + ' s)');
