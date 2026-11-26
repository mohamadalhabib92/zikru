// File de répétition : verset, plage, sourate, comptes, infini, pause. Pas de file infinie.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'hifz-repeat': H, 'hifz-repeat-ui': UI } = await loadLib(['hifz-repeat', 'hifz-repeat-ui'], 'hifz-rep');

const base = { scope: 'verse', each: 1, times: 1, pauseSec: 0, rate: 1 };
const walk = (c, max = 40) => {
  const out = [];
  let cur = c;
  for (let i = 0; i < max; i++) {
    const v = cur.verses[cur.index];
    const tick = H.afterRepeat(cur);
    out.push({ a: v.a, rep: cur.rep, pass: cur.pass, pauseMs: tick.kind === 'end' ? 0 : tick.pauseMs, end: tick.kind === 'end', kind: tick.kind });
    if (tick.kind === 'end') break;
    cur = tick.cursor;
  }
  return { out, cur };
};

let n = 0;
const t = (name, f) => {
  f();
  n++;
};

t('verset seul : 3 répétitions, pause 2 s, rien après la dernière', () => {
  const c = H.openCursor({ ...base, each: 3, pauseSec: 2 }, 1, 1, 7);
  const { out } = walk(c);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((x) => x.a), [1, 1, 1]);
  assert.deepEqual(out.map((x) => x.rep), [1, 2, 3]);
  assert.deepEqual(out.map((x) => x.pauseMs), [2000, 2000, 0]);
  assert.equal(out[2].end, true);
  const m = H.materialize(c);
  assert.equal(m.loop, false);
  assert.equal(m.queue.length, 3);
  assert.deepEqual(m.queue.map((s) => s.rep), [1, 2, 3]);
});

t('plage : versets 5 à 7, une fois chacun', () => {
  const c = H.openCursor({ ...base, scope: 'range', each: 1 }, 2, 7, 5);
  assert.deepEqual(c.verses.map((v) => v.a), [5, 6, 7]);
  const { out } = walk(c);
  assert.deepEqual(out.map((x) => [x.a, x.end]), [[5, false], [6, false], [7, true]]);
  assert.ok(out.every((x) => x.pauseMs === 0));
  const m = H.materialize(c);
  assert.deepEqual(m.queue.map((s) => [s.a, s.rep, s.pass]), out.map((x) => [x.a, x.rep, x.pass]));
});

t('plage : 5 fois chaque verset, 2 passages', () => {
  const c = H.openCursor({ ...base, scope: 'range', each: 5, times: 2, pauseSec: 1 }, 112, 1, 2);
  const { out } = walk(c, 40);
  assert.equal(out.length, 20);
  assert.equal(out[0].pauseMs, 1000);
  assert.equal(out[19].end, true);
  assert.equal(out[19].pauseMs, 0);
  assert.equal(out.filter((x) => x.pass === 1).length, 10);
  assert.equal(out.filter((x) => x.pass === 2).length, 10);
  assert.deepEqual(out.slice(0, 5).map((x) => x.rep), [1, 2, 3, 4, 5]);
  assert.equal(out[5].a, 2);
  assert.equal(out[10].pass, 2);
  assert.equal(out[10].a, 1);
  const m = H.materialize(c);
  assert.equal(m.loop, false);
  assert.equal(m.queue.length, out.length);
});

t('sourate entière : Al-Ikhlas, 4 versets', () => {
  const c = H.openCursor({ ...base, scope: 'sura' }, 112, 9, 1);
  assert.deepEqual(c.verses.map((v) => v.a), [1, 2, 3, 4]);
  const { out } = walk(c);
  assert.deepEqual(out.map((x) => x.a), [1, 2, 3, 4]);
  assert.equal(out.at(-1).end, true);
  assert.equal(H.materialize(c).queue.length, 4);
});

t('sourate Al-Fatiha : 7 versets × 20, une passe', () => {
  const c = H.openCursor({ ...base, scope: 'sura', each: 20 }, 1, 1, 1);
  const m = H.materialize(c);
  assert.equal(m.queue.length, 7 * 20);
  assert.equal(m.loop, false);
  assert.equal(H.formatRepeatProgress({ i: 3, n: 7, r: 2, each: 5, pass: 1, times: 1 }), 'Verset 3/7 · répétition 2/5');
});

t('infini par verset : on reste, la file ne grandit pas', () => {
  const c = H.openCursor({ ...base, scope: 'range', each: 0, times: 5, pauseSec: 4 }, 103, 1, 3);
  const { out, cur } = walk(c, 8);
  assert.equal(out.length, 8);
  assert.ok(out.every((x) => x.a === 1 && !x.end && x.kind === 'replay' && x.pauseMs === 4000));
  assert.deepEqual(out.map((x) => x.rep), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(cur.pass, 1);
  const m = H.materialize(c);
  assert.equal(m.queue.length, 1);
  assert.equal(m.loop, true);
  const next = H.skipRepeat(cur, 1);
  assert.equal(next.index, 1);
  assert.equal(next.rep, 1);
  assert.equal(H.materialize(next).queue[0].a, 2);
  assert.equal(H.skipRepeat(c, -1), null);
  assert.equal(H.formatRepeatProgress(H.progressOf(c)), 'Verset 1/3 · répétition ∞');
});

t('plage infinie : une passe en boucle, pause entre les versets', () => {
  const c = H.openCursor({ ...base, scope: 'range', each: 1, times: 0, pauseSec: 10 }, 108, 1, 2);
  const { out } = walk(c, 6);
  assert.equal(out.length, 6);
  assert.ok(out.every((x) => !x.end && x.pauseMs === 10000));
  assert.deepEqual(out.map((x) => x.pass), [1, 1, 2, 2, 3, 3]);
  assert.deepEqual(out.map((x) => x.a), [1, 2, 1, 2, 1, 2]);
  const m = H.materialize(c);
  assert.equal(m.loop, true);
  assert.equal(m.queue.length, 2);
  assert.equal(H.formatRepeatProgress({ i: 2, n: 2, r: 1, each: 1, pass: 1, times: 0 }), 'Verset 2/2 · répétition 1/1 · passage ∞');
});

t('passage fini visible dans le libellé', () => {
  assert.equal(H.formatRepeatProgress({ i: 3, n: 7, r: 2, each: 5, pass: 2, times: 3 }), 'Verset 3/7 · répétition 2/5 · passage 2/3');
});

t('pause bornée à 0–10 s, et compensée par la vitesse', () => {
  assert.equal(H.clampPause(0), 0);
  assert.equal(H.clampPause(10), 10);
  assert.equal(H.clampPause(11), 10);
  assert.equal(H.clampPause(-3), 0);
  assert.equal(H.clampPause(4.6), 5);
  assert.equal(H.clampPause(Number.NaN), 0);
  assert.equal(H.pauseGapSec(10, 1.5), 15);
  assert.equal(H.pauseGapSec(0, 2), 0);
  assert.equal(H.pauseGapSec(4, 0), 4);
});

t('réglages illisibles : défauts, sans champ en trop', () => {
  const d = H.sanitizeRepeat(null);
  assert.deepEqual(d, H.DEFAULT_REPEAT);
  const s = H.sanitizeRepeat({ scope: 'juz', each: 2, times: 9, pauseSec: 99, rate: 3, extra: 1 });
  assert.deepEqual(Object.keys(s).sort(), ['each', 'pauseSec', 'rate', 'scope', 'times']);
  assert.equal(s.scope, 'range');
  assert.equal(s.each, 3);
  assert.equal(s.times, 1);
  assert.equal(s.pauseSec, 10);
  assert.equal(s.rate, 1);
  assert.equal(H.sanitizeRepeat({ scope: 'sura', each: 0, times: 0, pauseSec: 0, rate: 0.75 }).each, 0);
});

t('bornes de sourate et de verset', () => {
  assert.equal(H.clampSurah(0), 1);
  assert.equal(H.clampSurah(200), 114);
  assert.equal(H.repeatVerses('verse', 2, 0, 50)[0].a, 1);
  assert.equal(H.repeatVerses('verse', 2, 999, 1)[0].a, 286);
  assert.equal(H.repeatVerses('sura', 114, 5, 8).length, 6);
  assert.equal(H.openCursor(base, 0, 0, 0).verses[0].s, 1);
});

t('clé de stockage neuve', () => {
  assert.equal(H.HIFZ_REPEAT_KEY, 'hifz-repeat');
  for (const k of ['hifz-prefs', 'hifz-cards', 'hifz-plan', 'hifz-streak']) assert.notEqual(H.HIFZ_REPEAT_KEY, k);
});

t('libellés dans toutes les langues d’interface', () => {
  const codes = ['en', 'de', 'ar', 'tr', 'ur', 'id', 'fa', 'ha', 'sw', 'es', 'it', 'pt', 'ff', 'wo'];
  const ar = /[\u0600-\u06FF]/;
  for (const [fr, row] of Object.entries(UI.REPEAT_UI)) {
    const vars = (fr.match(/\{\w+\}/g) ?? []).sort().join();
    for (const code of codes) {
      const v = row[code];
      assert.equal(typeof v, 'string', `${code} « ${fr} »`);
      assert.ok(v.trim(), code);
      assert.equal((v.match(/\{\w+\}/g) ?? []).sort().join(), vars, `${code} ${fr}`);
      if (code === 'ar' || code === 'ur' || code === 'fa') assert.ok(ar.test(v), code);
      if (code === 'de' || code === 'en') assert.equal(ar.test(v), false);
    }
  }
  assert.equal(H.playbackRateSupported(), true);
});

console.log(`hifz-repeat : ${n} tests OK`);
