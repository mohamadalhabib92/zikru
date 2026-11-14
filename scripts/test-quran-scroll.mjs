// Mesure : préparer Al-Baqara une fois, puis 40 « images » de défilement.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { loadLib } from './load-lib.mjs';

const { 'quran-layout': L } = await loadLib(['quran-layout'], 'quran-layout');
const t0 = performance.now();
const { AYAHS } = await import('../src/lib/quran-sura/s002.ts');
const loadMs = performance.now() - t0;
const metrics = { arSize: 28, lineH: 1.8, trSize: 16, showTr: true, showTl: false };

const b0 = performance.now();
for (let frame = 0; frame < 40; frame++) for (const text of AYAHS) L.ayahHeight(text, metrics);
const recomputeMs = performance.now() - b0;

const c0 = performance.now();
const layout = L.layoutAyahs(AYAHS, metrics);
for (let frame = 0; frame < 40; frame++) {
  const i = frame % AYAHS.length;
  assert.equal(layout.offsets[i] + layout.heights[i] <= layout.total, true);
}
const cachedMs = performance.now() - c0;

assert.equal(AYAHS.length, 286);
assert.ok(layout.offsets[0] === 0);
assert.ok(layout.offsets[285] > layout.offsets[1]);
assert.ok(cachedMs < recomputeMs, `cache ${cachedMs.toFixed(1)} ms devrait être sous le recalcul ${recomputeMs.toFixed(1)} ms`);
console.log(
  `Al-Baqara : ${AYAHS.length} versets, chargement ${loadMs.toFixed(1)} ms, 40 passages sans cache ${recomputeMs.toFixed(1)} ms, avec tableau réutilisé ${cachedMs.toFixed(1)} ms`,
);
