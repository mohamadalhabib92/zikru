// Fenêtre Mac et limites des fonctions qui n’existent pas sur un Mac.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { mac: M } = await loadLib(['mac'], 'mac');

assert.equal(M.isIosAppOnMac(), false, 'sans sonde native, on ne prend pas un iPad pour un Mac');
M.setIosAppOnMac(false);
assert.equal(M.shouldUseSidebar(390, false), false);
assert.equal(M.shouldUseSidebar(1024, false), true);
assert.equal(M.shouldUseSidebar(900, false), false, 'l’iPad étroit garde les onglets en bas');
M.setIosAppOnMac(true);
assert.equal(M.shouldUseSidebar(900, true), true);
assert.equal(M.shouldUseSidebar(899, true), false);
assert.equal(M.sidebarMin(true), 900);
assert.equal(M.sidebarMin(false), 1024);
assert.equal(M.CONTENT_MAX >= 900 && M.CONTENT_MAX <= 1100, true);

const off = M.macLimits(true);
assert.equal(off.haptics, false);
assert.equal(off.watch, false);
assert.equal(off.widgets, false);
assert.equal(off.liveActivity, false);
assert.equal(off.camera, false);
assert.equal(off.compass, false);
assert.equal(off.remotePush, false);
const on = M.macLimits(false);
assert.equal(on.haptics, true);
assert.equal(on.watch, true);
assert.equal(on.widgets, true);
assert.equal(on.camera, true);
assert.equal(on.compass, true);

M.setIosAppOnMac(false);
console.log('test-mac OK');
