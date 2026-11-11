// Traduction embarquée (Pickthall) et règles du téléchargement audio automatique.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const { AYAHS } = await import(pathToFileURL(path.join(root, 'src/lib/quran-tr/pickthall/s001.ts')).href);
const { AYAHS: throne } = await import(pathToFileURL(path.join(root, 'src/lib/quran-tr/pickthall/s002.ts')).href);
const { downloadHold, autoOrder, AUDIO_FREE_FLOOR } = await import(pathToFileURL(path.join(root, 'src/lib/audio-auto.ts')).href);

assert.equal(AYAHS.length, 7);
assert.equal(AYAHS[0], 'In the name of Allah, the Beneficent, the Merciful.');
assert.equal(throne.length, 286);
assert.ok(throne[254].startsWith('Allah! There is no deity save Him'), throne[254].slice(0, 40));

assert.equal(downloadHold({ wifiOnly: true, net: 'wifi', free: AUDIO_FREE_FLOOR }), 'ok');
assert.equal(downloadHold({ wifiOnly: true, net: 'cellular', free: null }), 'wifi');
assert.equal(downloadHold({ wifiOnly: false, net: 'cellular', free: null }), 'ok');
assert.equal(downloadHold({ wifiOnly: true, net: 'none', free: null }), 'offline');
assert.equal(downloadHold({ wifiOnly: false, net: 'wifi', free: AUDIO_FREE_FLOOR - 1 }), 'disk');
assert.equal(downloadHold({ wifiOnly: true, net: 'unknown', free: null }), 'wifi');

const done = (s) => s < 3;
assert.deepEqual(autoOrder(done, null).slice(0, 3), [3, 4, 5]);
assert.equal(autoOrder(done, 18)[0], 18);
assert.equal(autoOrder(() => true, 2).length, 0);
assert.equal(autoOrder((s) => s !== 2, 2)[0], 2);

const screen = (await import('node:fs')).readFileSync(path.join(root, 'src/lib/audio-store.native.ts'), 'utf8');
assert.ok(screen.includes('Paths.cache'), 'les mp3 ne vont pas dans Documents (sauvegarde iCloud)');
assert.ok(screen.includes('quran-audio'));

console.log('hors ligne : Pickthall inclus, audio en Wi-Fi, 200 Mo libres, Cache hors iCloud');
