// Droit Premium et ordre des objectifs de groupe.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'premium-logic': P, 'group-order': G } = await loadLib(['premium-logic', 'group-order'], 'premium');

const now = '2026-11-10T08:00:00.000Z';
const empty = P.emptyPremiumRecord();

assert.equal(P.PREMIUM_PRODUCT_ID, 'ch.mohamadba.zikru.premium.lifetime');
assert.equal(/^[A-Za-z0-9._]+$/.test(P.PREMIUM_PRODUCT_ID), true);
assert.equal(P.canCreatePremiumContent(empty, false), false, 'pas prêt : pas de création');
assert.equal(P.canCreatePremiumContent(empty, true), false, 'rien constaté : pas de création');

const seeded = P.observeLocalPremium(empty, { now, zikrIds: [], localGroupIds: [] });
assert.equal(seeded.grandfather, false);
assert.equal(seeded.decidedAt, now);
assert.equal(P.isUserCreatedLocalGroup({ id: P.SEEDED_LOCAL_GROUP_ID, createdAt: 0 }), false);
assert.equal(P.isUserCreatedLocalGroup({ id: 'g-jeudi', createdAt: 5 }), true);

const withZikr = P.observeLocalPremium(empty, { now, zikrIds: ['z1'], localGroupIds: [] });
assert.equal(withZikr.grandfather, true, 'un zikr déjà là accorde Premium');
assert.equal(P.canCreatePremiumContent(withZikr, true), true);
const later = P.observeLocalPremium(withZikr, { now: '2026-12-01T00:00:00.000Z', zikrIds: ['z1', 'z-new'], localGroupIds: ['g-new'] });
assert.deepEqual(later.zikrIds, ['z1'], 'une création après le constat ne devient pas une antériorité');
assert.equal(later.grandfather, true);

const joined = P.observeLocalPremium(empty, { now, zikrIds: [], localGroupIds: [] });
const fromServer = P.grantServerGrandfather(joined, now);
assert.equal(fromServer.grandfather, true, 'un groupe déjà créé sur le serveur accorde Premium');
assert.equal(P.grantServerGrandfather(fromServer, now), fromServer);

assert.equal(P.canEditExistingZikr(['z1', 'z2'], 'z1'), true);
assert.equal(P.canEditExistingZikr(['z1'], 'z-new'), false);

const bought = P.applyStoreCheck(seeded, { online: true, owned: true, transactionId: 'txn-1', platform: 'ios', now: 10 });
assert.equal(bought.store.transactionId, 'txn-1');
assert.equal(P.hasStorePremium(bought), true);
const offline = P.applyStoreCheck(bought, { online: false, owned: null, platform: 'ios', now: 20 });
assert.equal(offline.store.transactionId, 'txn-1', 'hors ligne : le cache reste');
const raced = P.applyStoreCheck(bought, { online: true, owned: false, platform: 'ios', now: 10 + 1000 });
assert.equal(raced.store.transactionId, 'txn-1', 'juste après l’achat, un store encore vide ne retire pas le droit');
const refunded = P.applyStoreCheck(bought, { online: true, owned: false, platform: 'ios', now: 10 + P.STORE_REVOKE_GRACE_MS });
assert.equal(refunded.store, null, 'remboursement en ligne, après le délai : l’achat part');
const kept = P.applyStoreCheck({ ...bought, grandfather: true }, { online: true, owned: false, platform: 'ios', now: 10 + P.STORE_REVOKE_GRACE_MS });
assert.equal(kept.grandfather, true, 'le remboursement ne retire pas l’antériorité');
assert.equal(P.canCreatePremiumContent(kept, true), true);

const junk = P.parsePremiumRecord({ store: { productId: 'autre', transactionId: 'x', platform: 'ios' }, grandfather: 'oui' });
assert.equal(junk.store, null);
assert.equal(junk.grandfather, false);
assert.equal(P.parsePremiumRecord('non').v, 1);

assert.equal(P.phaseFromStoreCode('user-cancelled'), 'cancelled');
assert.equal(P.phaseFromStoreCode('pending'), 'pending');
assert.equal(P.phaseFromStoreCode('deferred-payment'), 'pending');
assert.equal(P.phaseFromStoreCode('network-error'), 'offline');
assert.equal(P.phaseFromStoreCode('billing-unavailable'), 'offline');
assert.equal(P.phaseFromStoreCode('purchase-error'), 'failed');

const goals = [
  { id: 'a', position: null, created_at: '2026-01-02' },
  { id: 'b', position: null, created_at: '2026-01-03' },
];
assert.deepEqual(G.orderGroupGoals(goals).map((g) => g.id), ['b', 'a'], 'sans position : le plus récent d’abord');
const moved = G.positionsAfterMove(G.orderGroupGoals(goals), 'b', 1);
assert.deepEqual(moved, [{ id: 'a', position: 1 }, { id: 'b', position: 2 }]);
const placed = goals.map((g) => ({ ...g, position: moved.find((m) => m.id === g.id).position }));
assert.deepEqual(G.orderGroupGoals(placed).map((g) => g.id), ['a', 'b']);
assert.equal(G.positionsAfterMove(placed, 'a', -1), null);
assert.deepEqual(placed.map((g) => g.created_at), ['2026-01-02', '2026-01-03'], 'l’ordre ne réécrit pas les dates');

console.log('test-premium OK');
