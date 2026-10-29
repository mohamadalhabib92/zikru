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
for (const rel of ['recitation-queue', 'recitation', 'quran-nav', 'quran-meta', 'surahs']) {
  let src = readFileSync(join(root, 'src/lib', rel + '.ts'), 'utf8').replace(/from '(\.\.?\/[\w/-]+)'/g, "from '$1.mjs'");
  writeFileSync(join(dir, rel + '.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const Q = await import(join(dir, 'recitation-queue.mjs'));
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
