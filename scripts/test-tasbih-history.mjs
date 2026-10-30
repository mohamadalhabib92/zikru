// Tests de l'historique du tasbih : une ligne par séance (rafale Bluetooth, changement de dhikr, pause > 5 min,
// appuis hors ligne), regroupement à l'affichage des anciennes lignes fragmentées, total inchangé.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'tasbih-core': C, 'tasbih-log': Lg } = await loadLib(['tasbih-core', 'tasbih-log'], 'history');
const T0 = Date.parse('2026-10-29T14:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
let fail = 0;
let n = 0;
const test = (name, f) => {
  n++;
  try {
    f();
  } catch (e) {
    fail++;
    console.error('✗', name, '\n ', e.message);
  }
};
let ids = 0;
const id = () => `s${++ids}`;
const LABEL = 'Mon zikr · Une descendance bonne';
/** Document avec n appuis Bluetooth à partir de `at`, un par seconde. */
function press(doc, k, at, src = 'bluetooth') {
  for (let i = 0; i < k; i++) doc = Lg.recordClicks(doc, 1, src, at + i * 1000).doc;
  return doc;
}
const close = (doc, at, opts) => Lg.updateState(doc, (t) => C.closeSession(t, id(), iso(at), opts));
const aim = (doc, dhikrId, target = 1) => Lg.updateState(doc, (t) => ({ ...t, dhikrId, target }));

test('rafale Bluetooth sur une étape ×1 : une seule ligne, pas une par appui', () => {
  let d = aim(Lg.newDoc('dev'), LABEL);
  for (let i = 0; i < 60; i++) {
    d = press(d, 1, T0 + i * 1000);
    d = close(d, T0 + i * 1000); // l'étape ×1 est terminée à chaque appui
  }
  assert.equal(d.t.sessions.length, 1);
  const s = d.t.sessions[0];
  assert.equal(s.count, 60);
  assert.equal(s.source, 'bluetooth');
  assert.equal(s.deviceCount, 60);
  assert.equal(s.parts, 60);
  assert.equal(s.start, iso(T0));
  assert.equal(s.at, iso(T0 + 59000));
  assert.equal(d.t.total, 60);
  assert.equal(Lg.sumLog(d.log) + d.base, 60, 'journal intact');
});

test('changement de dhikr : nouvelle ligne', () => {
  let d = aim(Lg.newDoc('dev'), 'istighfar', 33);
  d = close(press(d, 10, T0), T0 + 10000);
  d = Lg.updateState(d, (t) => C.switchDhikr(t, 'subhanallah', 33));
  d = close(press(d, 5, T0 + 20000), T0 + 25000);
  assert.deepEqual(d.t.sessions.map((s) => [s.dhikrId, s.count]), [['subhanallah', 5], ['istighfar', 10]]);
  // revenir au premier dhikr ne rouvre pas sa ligne
  d = Lg.updateState(d, (t) => C.switchDhikr(t, 'istighfar', 33));
  d = close(press(d, 2, T0 + 30000), T0 + 32000);
  assert.equal(d.t.sessions.length, 3);
  assert.equal(d.t.total, 17);
});

test('étapes différentes d\'une composition : une ligne par étape', () => {
  let d = aim(Lg.newDoc('dev'), 'Mon zikr · A', 3);
  d = close(press(d, 3, T0), T0 + 3000);
  d = aim(d, 'Mon zikr · B', 1);
  d = close(press(d, 1, T0 + 4000), T0 + 4000);
  assert.deepEqual(d.t.sessions.map((s) => s.dhikrId), ['Mon zikr · B', 'Mon zikr · A']);
});

test('pause de plus de 5 min : nouvelle ligne ; moins de 5 min : même ligne', () => {
  let d = aim(Lg.newDoc('dev'), LABEL);
  d = close(press(d, 1, T0), T0);
  d = close(press(d, 1, T0 + 4 * 60000), T0 + 4 * 60000);
  assert.equal(d.t.sessions.length, 1);
  d = close(press(d, 1, T0 + 10 * 60000), T0 + 10 * 60000);
  assert.equal(d.t.sessions.length, 2);
  assert.deepEqual(d.t.sessions.map((s) => s.count), [1, 2]);
});

test('hors ligne : appuis rattrapés avec leurs dates d\'origine, une seule ligne', () => {
  let d = aim(Lg.newDoc('dev'), LABEL);
  d = close(press(d, 1, T0), T0);
  // rattrapage tardif (connexion revenue 20 min plus tard) d'appuis faits à T0+30s… : dates des événements
  d = Lg.recordClicks(d, 7, 'bluetooth', T0 + 30000).doc;
  d = close(d, T0 + 20 * 60000);
  assert.equal(d.t.sessions.length, 1, 'le début réel (T0+30s) suit la ligne précédente de < 5 min');
  assert.equal(d.t.sessions[0].count, 8);
  assert.equal(d.t.total, 8);
});

test('source différente (manuel puis Bluetooth) : lignes séparées', () => {
  let d = aim(Lg.newDoc('dev'), LABEL);
  d = close(press(d, 1, T0, 'manuel'), T0);
  d = close(press(d, 1, T0 + 1000), T0 + 1000);
  assert.deepEqual(d.t.sessions.map((s) => s.source), ['bluetooth', 'manuel']);
});

test('« Enregistrer » et remise à zéro ferment la ligne', () => {
  let d = aim(Lg.newDoc('dev'), 'istighfar', 33);
  d = close(press(d, 5, T0), T0 + 5000, { explicit: true });
  d = close(press(d, 5, T0 + 6000), T0 + 11000, { explicit: true });
  assert.equal(d.t.sessions.length, 2);
  assert.ok(d.t.sessions.every((s) => s.sealed));
  d = press(d, 3, T0 + 12000);
  d = Lg.updateState(d, C.resetCount);
  assert.equal(d.t.count, 0);
  assert.equal(d.t.total, 13, 'la remise à zéro ne touche ni le journal ni le total');
  d = close(press(d, 2, T0 + 20000), T0 + 22000);
  assert.equal(d.t.sessions.length, 3);
});

test('closeSession sans appui : état inchangé', () => {
  const t = { count: 0, target: 33, dhikrId: 'x', total: 4, sessions: [] };
  assert.equal(C.closeSession(t, 'a', iso(T0)), t);
});

test('affichage : anciennes lignes fragmentées regroupées, données et total inchangés', () => {
  // 40 lignes d'une ancienne version (une par appui, du plus récent au plus ancien) + une ligne Astaghfiru-llāh
  const legacy = [];
  for (let i = 39; i >= 0; i--) legacy.push({ id: `l${i}`, dhikrId: LABEL, count: 1, target: 1, at: iso(T0 + i * 1000), source: 'bluetooth', deviceCount: 1 });
  legacy.push({ id: 'ast', dhikrId: 'istighfar', count: 44, target: 33, at: iso(T0 - 3600000), source: 'bluetooth', deviceCount: 44 });
  legacy.unshift({ id: 'new', dhikrId: LABEL, count: 1, target: 1, at: iso(T0 + 3 * 3600000), source: 'bluetooth', deviceCount: 1 });
  const frozen = JSON.stringify(legacy);
  const g = C.groupSessions(legacy);
  assert.equal(JSON.stringify(legacy), frozen, 'non destructif');
  assert.deepEqual(g.map((s) => [s.dhikrId, s.count]), [[LABEL, 1], [LABEL, 40], ['istighfar', 44]]);
  assert.equal(g[1].parts, 40);
  assert.equal(g[1].start, iso(T0));
  assert.equal(g[1].at, iso(T0 + 39000));
  const sum = (a) => a.reduce((x, s) => x + s.count, 0);
  assert.equal(sum(g), sum(legacy));
  // le total affiché vient du journal, pas de l'historique : un document migré garde son total
  const doc = Lg.migrate({ count: 0, target: 33, dhikrId: 'subhanallah', total: 1889, sessions: legacy }, () => 'dev');
  assert.equal(doc.t.total, 1889);
  assert.equal(doc.t.sessions.length, legacy.length);
});

test('affichage : une ligne close n\'est pas fusionnée', () => {
  const a = { id: 'a', dhikrId: 'x', count: 2, target: 33, at: iso(T0), source: 'manuel', sealed: true };
  const b = { id: 'b', dhikrId: 'x', count: 3, target: 33, at: iso(T0 + 1000), source: 'manuel' };
  assert.equal(C.groupSessions([b, a]).length, 2);
});

if (fail) {
  console.error(`historique du tasbih : ${fail}/${n} échec(s)`);
  process.exit(1);
}
console.log(`historique du tasbih : ${n} tests OK`);
