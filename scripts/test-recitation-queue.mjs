// Tests de la file de récitation : avance verset → verset, répétitions, boucle, préchargement, saut, reprise réseau,
// jeton anti-double-avance (fin en double / en retard), détection de blocage — et simulation d’une sourate entière.
import ts from 'typescript';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = join(root, 'node_modules', '.cache');
mkdirSync(base, { recursive: true });
const dir = mkdtempSync(join(base, 'zikru-recq-'));
for (const rel of ['recitation-queue', 'recitation', 'quran-nav', 'quran-meta', 'surahs', 'quran-playback']) {
  let src = readFileSync(join(root, 'src/lib', rel + '.ts'), 'utf8').replace(/from '(\.\.?\/[\w/-]+)'/g, "from '$1.mjs'");
  writeFileSync(join(dir, rel + '.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const Q = await import(join(dir, 'recitation-queue.mjs'));
const B = await import(join(dir, 'quran-playback.mjs'));
const { buildQueue } = await import(join(dir, 'recitation.mjs'));

let n = 0;
const t = (name, f) => {
  f();
  n++;
};
const fat = buildQueue([1, 2, 3, 4, 5, 6, 7].map((a) => [1, a]));

t('avance simple', () => {
  assert.deepEqual(Q.advance(fat, 0, false), { next: 1, same: false });
  assert.deepEqual(Q.advance(fat, 5, false), { next: 6, same: false });
  assert.equal(Q.advance(fat, 6, false), null);
  assert.deepEqual(Q.advance(fat, 6, true), { next: 0, same: false });
  assert.equal(Q.advance([], 0, true), null);
  assert.equal(Q.advance(fat, -1, false), null);
  assert.equal(Q.advance(fat, 99, true), null);
});
t('répétitions : même verset sans rechargement', () => {
  const q = buildQueue([[2, 1], [2, 2]], 3, 1);
  assert.equal(q.length, 6);
  assert.deepEqual(Q.advance(q, 0, false), { next: 1, same: true });
  assert.deepEqual(Q.advance(q, 2, false), { next: 3, same: false });
  const one = buildQueue([[1, 1]], 1, 1);
  assert.deepEqual(Q.advance(one, 0, true), { next: 0, same: true });
});
t('préchargement : prochain verset différent', () => {
  const q = buildQueue([[2, 1], [2, 2]], 3, 1);
  assert.equal(Q.nextDistinct(q, 0, false), 3);
  assert.equal(Q.nextDistinct(q, 4, false), -1);
  assert.equal(Q.nextDistinct(q, 4, true), 0);
  assert.equal(Q.nextDistinct(fat, 6, false), -1);
  assert.equal(Q.nextDistinct(buildQueue([[1, 1]], 2, 1), 0, true), -1);
});
t('saut verset suivant / précédent', () => {
  const q = buildQueue([[2, 1], [2, 2], [2, 3]], 2, 1);
  assert.equal(Q.skipTarget(q, 0, 1), 2);
  assert.equal(Q.skipTarget(q, 3, 1), 4);
  assert.equal(Q.skipTarget(q, 3, -1), 0);
  assert.equal(Q.skipTarget(q, 1, -1), -1);
  assert.equal(Q.skipTarget(q, 5, 1), -1);
  assert.equal(Q.skipTarget([], 0, 1), -1);
});
t('plan de reprise réseau', () => {
  assert.deepEqual(Q.retryPlan(1, true), { useFallback: true, delayMs: 0 });
  assert.deepEqual(Q.retryPlan(2, true), { useFallback: false, delayMs: 1500 });
  assert.deepEqual(Q.retryPlan(3, true), { useFallback: true, delayMs: 3000 });
  assert.equal(Q.retryPlan(4, true), null);
  assert.deepEqual(Q.retryPlan(1, false), { useFallback: false, delayMs: 1500 });
  assert.equal(Q.retryPlan(3, false), null);
  assert.equal(Q.retryPlan(0, true), null);
});
t('jeton : une seule avance par chargement, fins périmées ignorées', () => {
  const g = Q.createTokenGate();
  const a = g.begin();
  assert.equal(g.finish(a), true);
  assert.equal(g.finish(a), false, 'fin en double ignorée');
  const b = g.begin();
  assert.equal(g.finish(a), false, 'fin du verset précédent ignorée');
  assert.equal(g.isCurrent(b), true);
  assert.equal(g.finish(), true);
  g.begin();
  assert.equal(g.isCurrent(b), false);
});
t('blocage', () => {
  assert.equal(Q.isStalled({ playing: true, waitingGap: false, now: 20000, lastProgressAt: 5000 }), true);
  assert.equal(Q.isStalled({ playing: true, waitingGap: true, now: 20000, lastProgressAt: 5000 }), false);
  assert.equal(Q.isStalled({ playing: false, waitingGap: false, now: 20000, lastProgressAt: 5000 }), false);
  assert.equal(Q.isStalled({ playing: true, waitingGap: false, now: 10000, lastProgressAt: 5000 }), false);
  assert.equal(Q.isStalled({ playing: true, waitingGap: false, now: 20000, lastProgressAt: 5000, buffering: true }), false);
  assert.equal(Q.isStalled({ playing: true, waitingGap: false, now: 20000, lastProgressAt: 5000, interrupted: true }), false);
  assert.equal(Q.isStalled({ playing: true, waitingGap: false, now: 20000, lastProgressAt: 5000, userPaused: true }), false);
});
t('pause native : interruption ou démarrage figé', () => {
  const base = { intentPlaying: true, userPaused: false, didJustFinish: false, isBuffering: false, nativePlaying: false, currentTime: 4, loading: false, waitingGap: false };
  assert.equal(Q.nativePauseKind(base), 'interruption');
  assert.equal(Q.nativePauseKind({ ...base, userPaused: true }), 'none');
  assert.equal(Q.nativePauseKind({ ...base, waitingGap: true }), 'none');
  assert.equal(Q.nativePauseKind({ ...base, isBuffering: true }), 'buffering');
  assert.equal(Q.nativePauseKind({ ...base, currentTime: 0, loading: true }), 'buffering');
  assert.equal(Q.nativePauseKind({ ...base, currentTime: 0 }), 'startup-stall');
  assert.equal(Q.nativePauseKind({ ...base, currentTime: 12, duration: 12.1 }), 'none');
});
t('fin périmée : ne marque pas le nouveau chargement et n’avance pas', () => {
  const g = Q.createTokenGate();
  const a = g.begin();
  let loaded = -1;
  let r = Q.nextLoadedToken({ didJustFinish: false, isLoaded: true, playingIntent: true, loadedToken: loaded, token: a });
  loaded = r;
  assert.equal(loaded, a);
  assert.equal(Q.canAcceptFinish({ didJustFinish: true, playingIntent: true, loadedToken: loaded, token: a, sawProgress: true }), true);
  assert.equal(g.finish(a), true);
  const b = g.begin();
  r = Q.nextLoadedToken({ didJustFinish: true, isLoaded: true, playingIntent: true, loadedToken: loaded, token: b });
  assert.equal(r, a, 'une fin tardive ne devient pas le chargement courant');
  assert.equal(Q.canAcceptFinish({ didJustFinish: true, playingIntent: true, loadedToken: r, token: b, sawProgress: false }), false);
  assert.equal(g.finish(a), false, 'le jeton précédent reste périmé');
  assert.equal(g.isCurrent(b), true);
  r = Q.nextLoadedToken({ didJustFinish: false, isLoaded: true, playingIntent: true, loadedToken: r, token: b });
  assert.equal(r, b);
  assert.equal(Q.canAcceptFinish({ didJustFinish: true, playingIntent: true, loadedToken: r, token: b, sawProgress: false }), false, 'sans progression réelle');
  assert.equal(Q.canAcceptFinish({ didJustFinish: true, playingIntent: false, loadedToken: r, token: b, sawProgress: true }), false, 'pause utilisateur');
});
const three = buildQueue([[18, 1], [18, 2], [18, 3]]);
t('lecture normale : enchaîne, dernier verset sans recommencer', () => {
  assert.equal(Q.MEDITATIVE_GAP_MS, 5000);
  assert.deepEqual(Q.planVerseEnd({ queue: three, pos: 0, loop: false, mode: 'normal', normalDelayMs: 0 }), { type: 'now', next: 1, same: false });
  assert.deepEqual(Q.planVerseEnd({ queue: three, pos: 1, loop: false, mode: 'normal', normalDelayMs: 2000 }), { type: 'wait', delayMs: 2000, next: 2, same: false });
  assert.deepEqual(Q.planVerseEnd({ queue: three, pos: 2, loop: false, mode: 'normal', normalDelayMs: 0 }), { type: 'end' });
});
t('lecture méditative : 5 s exactement une fois, puis le suivant', () => {
  const plan = Q.planVerseEnd({ queue: three, pos: 0, loop: false, mode: 'meditative', normalDelayMs: 0 });
  assert.deepEqual(plan, { type: 'wait', delayMs: 5000, next: 1, same: false });
  let s = B.mountQuranOwner(B.createQuranSession(), 'mushaf', 'meditative');
  s = B.requestQuranPlay(s, 'mushaf').session;
  const first = B.onQuranVerseFinished(s, 'mushaf', plan);
  assert.equal(first.decision.effect, 'wait');
  assert.equal(first.decision.delayMs, 5000);
  const again = B.onQuranVerseFinished(first.session, 'mushaf', plan);
  assert.equal(again.decision.effect, 'ignore', 'une seule pause par fin de verset');
  const late = B.fireQuranPending(first.session, 'mushaf', first.decision.epoch + 99);
  assert.equal(late.play, false);
  const go = B.fireQuranPending(first.session, 'mushaf', first.decision.epoch);
  assert.equal(go.play, true);
  assert.equal(go.next, 1);
  const twice = B.fireQuranPending(go.session, 'mushaf', first.decision.epoch);
  assert.equal(twice.play, false, 'le minuteur ne part pas deux fois');
  assert.equal(B.audibleOwner(go.session), 'mushaf');
});
t('pause, arrêt, prise de main, démontage : le minuteur ne relance rien', () => {
  const plan = Q.planVerseEnd({ queue: three, pos: 0, loop: false, mode: 'meditative', normalDelayMs: 0 });
  const start = () => {
    let s = B.requestQuranPlay(B.mountQuranOwner(B.createQuranSession(), 'sourate'), 'sourate').session;
    const w = B.onQuranVerseFinished(s, 'sourate', plan);
    return { s: w.session, epoch: w.decision.epoch };
  };
  {
    const { s, epoch } = start();
    const paused = B.userPauseQuran(s, 'sourate');
    assert.equal(B.fireQuranPending(paused, 'sourate', epoch).play, false);
    assert.equal(B.audibleOwner(paused), null);
    const back = B.resumeQuranPlay(paused, 'sourate');
    assert.deepEqual(back.resumeNext, { next: 1, same: false });
    assert.equal(B.audibleOwner(back.session), 'sourate');
  }
  {
    const { s, epoch } = start();
    const stopped = B.userStopQuran(s, 'sourate');
    assert.equal(B.fireQuranPending(stopped, 'sourate', epoch).play, false);
    assert.equal(B.resumeQuranPlay(stopped, 'sourate').resumeNext, null);
  }
  {
    const { s, epoch } = start();
    const taken = B.requestQuranPlay(B.mountQuranOwner(s, 'mushaf'), 'mushaf');
    assert.deepEqual(taken.preempted, ['sourate']);
    assert.equal(B.audibleOwner(taken.session), 'mushaf');
    assert.equal(B.fireQuranPending(taken.session, 'sourate', epoch).play, false);
    assert.equal(B.fireQuranPending(taken.session, 'mushaf', epoch).play, false);
  }
  {
    const { s, epoch } = start();
    const switched = B.requestQuranPlay(s, 'sourate');
    assert.equal(switched.session.owners.sourate.pending, null);
    assert.equal(B.fireQuranPending(switched.session, 'sourate', epoch).play, false, 'changer de source annule l’attente');
    assert.equal(B.audibleOwner(switched.session), 'sourate');
  }
  {
    const { s, epoch } = start();
    const left = B.unmountQuranOwner(s, 'sourate');
    assert.equal(B.audibleOwner(left), null);
    assert.equal(B.fireQuranPending(left, 'sourate', epoch).play, false);
  }
});
t('changement de mode : réconcilie l’attente, sans second départ', () => {
  let s = B.requestQuranPlay(B.mountQuranOwner(B.createQuranSession(), 'mushaf', 'meditative'), 'mushaf').session;
  const plan = Q.planVerseEnd({ queue: three, pos: 1, loop: false, mode: 'meditative', normalDelayMs: 0 });
  const w = B.onQuranVerseFinished(s, 'mushaf', plan);
  const epoch = w.decision.epoch;
  const normal = B.applyQuranMode(w.session, 'mushaf', 'normal');
  assert.equal(normal.decision.effect, 'advance-now');
  assert.equal(normal.decision.next, 2);
  assert.equal(B.fireQuranPending(normal.session, 'mushaf', epoch).play, false, 'l’ancien délai de 5 s est annulé');
  const idle = B.applyQuranMode(normal.session, 'mushaf', 'meditative');
  assert.equal(idle.decision.effect, 'ignore', 'sans attente, on ne relance pas le verset');
  let s2 = B.requestQuranPlay(B.createQuranSession(), 'hifz').session;
  s2 = B.applyQuranMode(s2, 'hifz', 'normal').session;
  const gap = B.onQuranVerseFinished(s2, 'hifz', Q.planVerseEnd({ queue: three, pos: 0, loop: false, mode: 'normal', normalDelayMs: 2000 }));
  assert.equal(gap.decision.delayMs, 2000);
  const med = B.applyQuranMode(gap.session, 'hifz', 'meditative');
  assert.equal(med.decision.effect, 'wait');
  assert.equal(med.decision.delayMs, 5000);
  assert.notEqual(med.decision.epoch, gap.decision.epoch);
  assert.equal(B.fireQuranPending(med.session, 'hifz', gap.decision.epoch).play, false);
  const once = B.fireQuranPending(med.session, 'hifz', med.decision.epoch);
  assert.equal(once.play, true);
  assert.equal(B.fireQuranPending(once.session, 'hifz', med.decision.epoch).play, false);
});
t('un seul lecteur : ouvrir le mushaf ne lance rien, un départ explicite coupe le précédent', () => {
  let s = B.mountQuranOwner(B.createQuranSession(), 'kahf');
  s = B.requestQuranPlay(s, 'kahf').session;
  s = B.mountQuranOwner(s, 'mushaf');
  assert.equal(B.audibleOwner(s), 'kahf', 'ouvrir le mushaf ne démarre pas une seconde récitation');
  assert.equal(s.owners.mushaf.intent, 'idle');
  const play = B.requestQuranPlay(s, 'mushaf');
  assert.deepEqual(play.preempted, ['kahf']);
  assert.equal(B.audibleOwner(play.session), 'mushaf');
  assert.equal(play.session.owners.kahf.intent, 'yielded');
  assert.equal(play.session.owners.kahf.pending, null);
  const gen = play.generation;
  const again = B.requestQuranPlay(play.session, 'mushaf');
  assert.notEqual(again.generation, gen);
  assert.equal(B.isCurrentGeneration(again.session, 'mushaf', gen), false, 'un départ périmé ne rejoue pas');
  assert.equal(B.isCurrentGeneration(again.session, 'mushaf', again.generation), true);
  assert.equal(B.audibleOwner(again.session), 'mushaf');
});
t('dernier verset méditatif : fin sans boucle', () => {
  let s = B.requestQuranPlay(B.mountQuranOwner(B.createQuranSession(), 'sourate', 'meditative'), 'sourate').session;
  const end = B.onQuranVerseFinished(s, 'sourate', Q.planVerseEnd({ queue: three, pos: 2, loop: false, mode: 'meditative', normalDelayMs: 0 }));
  assert.equal(end.decision.effect, 'end');
  assert.equal(end.session.owners.sourate.pending, null);
  assert.equal(B.audibleOwner(end.session), null);
  assert.equal(B.onQuranVerseFinished(end.session, 'sourate', { type: 'end' }).decision.effect, 'ignore');
});
t('simulation : Al-Baqara entière avec fins en double et en retard', () => {
  const q = buildQueue(Array.from({ length: 286 }, (_, i) => [2, i + 1]));
  const g = Q.createTokenGate();
  let pos = 0;
  let loads = 1;
  let tok = g.begin();
  const played = [q[0].a];
  for (let guard = 0; guard < 2000; guard++) {
    const stale = tok;
    // natif : fin émise, parfois deux fois ; un événement périmé arrive aussi après le chargement suivant
    const fire = () => {
      if (!g.finish(g.current)) return false;
      const nx = Q.advance(q, pos, false);
      if (!nx) return 'end';
      pos = nx.next;
      tok = g.begin();
      loads++;
      played.push(q[pos].a);
      return true;
    };
    const r = fire();
    if (r === 'end') break;
    if (guard % 3 === 0) assert.equal(g.finish(stale), false, 'fin périmée ignorée');
    if (guard % 5 === 0) assert.equal(g.finish(stale), false, 'fin en double ignorée');
  }
  assert.equal(pos, 285);
  assert.equal(loads, 286);
  assert.deepEqual(played, Array.from({ length: 286 }, (_, i) => i + 1));
});
console.log(`test-recitation-queue : ${n} groupes OK`);
