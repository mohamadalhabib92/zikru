import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'web-keys': W, 'ui-strings-web': S } = await loadLib(['web-keys', 'ui-strings-web']);

const base = { key: 'x', meta: false, ctrl: false, alt: false, shift: false, typing: false, pendingG: false, onQuran: false };
const step = (over) => W.reduceWebKey({ ...base, ...over });

assert.equal(step({ key: 'g' }).pendingG, true);
assert.equal(step({ key: 'g' }).action.kind, 'none');
assert.deepEqual(step({ key: 'h', pendingG: true }).action, { kind: 'go', path: '/' });
assert.deepEqual(step({ key: 'p', pendingG: true }).action, { kind: 'go', path: '/prayers' });
assert.deepEqual(step({ key: 'l', pendingG: true }).action, { kind: 'go', path: '/quran' });
assert.deepEqual(step({ key: 'd', pendingG: true }).action, { kind: 'go', path: '/discussion' });
assert.equal(step({ key: 'z', pendingG: true }).action.kind, 'none');
assert.equal(step({ key: 'z', pendingG: true }).pendingG, false);

assert.equal(step({ key: '?' }).action.kind, 'help');
assert.equal(step({ key: '/', shift: true }).action.kind, 'help');
assert.equal(step({ key: '/' }).action.kind, 'search');
assert.equal(step({ key: 'k', ctrl: true }).action.kind, 'search');
assert.equal(step({ key: 'k', meta: true }).action.kind, 'search');
assert.equal(step({ key: 'f', ctrl: true }).action.kind, 'none');
assert.equal(step({ key: 'Escape' }).action.kind, 'back');

assert.equal(step({ key: 'g', typing: true }).pendingG, false);
assert.equal(step({ key: '?', typing: true }).action.kind, 'none');
assert.equal(step({ key: 'Escape', typing: true }).action.kind, 'none');

assert.equal(step({ key: 'j', onQuran: true }).action.cmd, 'next');
assert.equal(step({ key: 'k', onQuran: true }).action.cmd, 'prev');
assert.equal(step({ key: 'p', onQuran: true }).action.cmd, 'toggle');
assert.equal(step({ key: 'j', onQuran: false }).action.kind, 'none');
assert.equal(step({ key: 'ArrowDown', onQuran: true }).action.kind, 'none');
assert.equal(step({ key: ' ', onQuran: true }).action.kind, 'none');
assert.equal(step({ key: 'j', onQuran: true, pendingG: true }).action.kind, 'none');

assert.equal(W.isTypingTarget('INPUT', false), true);
assert.equal(W.isTypingTarget('textarea', false), true);
assert.equal(W.isTypingTarget('div', true), true);
assert.equal(W.isTypingTarget('DIV', false), false);

assert.equal(W.isQuranReaderPath('/zikru/quran/2'), true);
assert.equal(W.isQuranReaderPath('/quran/114?a=3'), true);
assert.equal(W.isQuranReaderPath('/zikru/quran'), false);
assert.equal(W.isQuranReaderPath('/zikru/quran/bookmarks'), false);

const paths = new Set(Object.values({ h: '/', p: '/prayers', t: '/tasbih', l: '/quran', m: '/more', a: '/adhkar', f: '/fiqh', c: '/community', d: '/discussion', s: '/search' }));
for (const id of ['h', 'p', 't', 'l', 'm', 'a', 'f', 'c', 'd', 's']) {
  const action = step({ key: id, pendingG: true }).action;
  assert.equal(action.kind, 'go');
  assert.equal(paths.has(action.path), true);
  assert.equal(action.path.startsWith('/'), true);
  assert.equal(action.path.includes('http'), false);
}

let heard = null;
const off = W.subscribeReaderKeys((cmd) => {
  heard = cmd;
});
assert.equal(W.emitReaderKey('next'), true);
assert.equal(heard, 'next');
off();
assert.equal(W.emitReaderKey('next'), false);

for (const row of W.WEB_KEY_ROWS) {
  assert.ok(S.UI_STRINGS_WEB[row.label], 'libellé sans traduction : ' + row.label);
}
assert.ok(S.UI_STRINGS_WEB['Raccourcis clavier']);
assert.ok(S.UI_STRINGS_WEB['Fermer l’aide']);

console.log('test-web-keys OK');
