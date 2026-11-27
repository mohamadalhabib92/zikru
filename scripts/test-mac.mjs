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

// Nktub : iPad seulement. iPhone, Mac (« Designed for iPad ») et tvOS restent masqués.
assert.equal(M.nktubAvailable({ os: 'ios', isPad: true, mac: false }), true, 'iPad');
assert.equal(M.nktubAvailable({ os: 'ios', isPad: false, mac: false }), false, 'iPhone');
assert.equal(M.nktubAvailable({ os: 'ios', isPad: true, mac: true }), false, 'Mac, Designed for iPad');
assert.equal(M.nktubAvailable({ os: 'ios', isPad: false, mac: false }), false, 'tvOS : isPad est faux');
assert.equal(M.nktubAvailable({ os: 'android', isPad: true, mac: false }), false, 'Android');
assert.equal(M.nktubAvailable({ os: 'web', isPad: true, mac: false }), false, 'web');
M.setIosAppOnMac(true);
assert.equal(M.nktubAvailable({ os: 'ios', isPad: true }), false, 'sans mac explicite, le drapeau Mac compte');
M.setIosAppOnMac(false);
assert.equal(M.nktubAvailable({ os: 'ios', isPad: true }), true, 'iPad quand le drapeau Mac est faux');
assert.equal(M.nktubAvailable({ os: 'ios', isPad: true, mac: false }), true, 'mac: false prime sur le drapeau');
M.setIosAppOnMac(true);
assert.equal(M.nktubAvailable({ os: 'ios', isPad: true, mac: false }), true, 'un iPad simulé n’est pas un Mac');
M.setIosAppOnMac(false);
assert.equal(typeof M.nktubAvailable(), 'boolean', 'sans env, la lecture de Platform ne jette pas');

console.log('test-mac OK');
