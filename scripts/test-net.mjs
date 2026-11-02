// v2 : nouvel essai exponentiel + délai maximal, uniquement pour les lectures.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { net: N } = await loadLib(['net'], 'net');
let ok = 0;
const t = async (name, fn) => {
  await fn();
  ok++;
  console.log('✓ ' + name);
};
const res = (status) => ({ status, ok: status < 400 });
const seq = (...xs) => {
  let i = 0;
  const calls = [];
  return { calls, f: async (u) => { calls.push(u); const x = xs[Math.min(i++, xs.length - 1)]; if (x instanceof Error) throw x; return res(x); } };
};
const slept = [];
const sleep = async (ms) => void slept.push(ms);

await t('délais exponentiels plafonnés', () => {
  assert.deepEqual([0, 1, 2, 3, 10].map((a) => N.retryDelay(a, 500, 8000)), [500, 1000, 2000, 4000, 8000]);
});
await t('5xx puis 200 : réussit au 2e essai', async () => {
  const s = seq(503, 200);
  const r = await N.fetchWithRetry('u', {}, { fetchImpl: s.f, sleep });
  assert.equal(r.status, 200);
  assert.equal(s.calls.length, 2);
});
await t('404 : aucun nouvel essai', async () => {
  const s = seq(404, 200);
  assert.equal((await N.fetchWithRetry('u', {}, { fetchImpl: s.f, sleep })).status, 404);
  assert.equal(s.calls.length, 1);
});
await t('erreur réseau répétée : lève après retries + 1 essais', async () => {
  const s = seq(new Error('offline'));
  await assert.rejects(N.fetchWithRetry('u', {}, { fetchImpl: s.f, sleep, retries: 2 }), /offline/);
  assert.equal(s.calls.length, 3);
});
await t('429 persistant : renvoie la dernière réponse', async () => {
  const s = seq(429);
  assert.equal((await N.fetchWithRetry('u', {}, { fetchImpl: s.f, sleep, retries: 1 })).status, 429);
});
await t('délai dépassé : la requête est annulée', async () => {
  const f = (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  await assert.rejects(N.fetchWithRetry('u', {}, { fetchImpl: f, sleep, retries: 0, timeoutMs: 20 }), /aborted/);
});
console.log(`test-net OK : ${ok} tests`);
