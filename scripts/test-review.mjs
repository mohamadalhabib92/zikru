// v2 : demande de note — après une réussite seulement, ≤ 1 fois / 90 jours, jamais < 24 h après une erreur ni le premier jour.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'review-policy': R } = await loadLib(['review-policy'], 'review');
const DAY = 86_400_000;
const T = Date.UTC(2026, 10, 2);
let ok = 0;
const t = (name, fn) => {
  fn();
  ok++;
  console.log('✓ ' + name);
};
t('jamais sans date de première ouverture, ni le premier jour', () => {
  assert.equal(R.shouldAskReview({ asks: 0 }, T), false);
  assert.equal(R.shouldAskReview({ asks: 0, firstSeenAt: T - 3600_000 }, T), false);
  assert.equal(R.shouldAskReview({ asks: 0, firstSeenAt: T - 2 * DAY }, T), true);
});
t('au plus une fois tous les 90 jours', () => {
  const s = { asks: 1, firstSeenAt: T - 400 * DAY, lastAskAt: T - 89 * DAY };
  assert.equal(R.shouldAskReview(s, T), false);
  assert.equal(R.shouldAskReview({ ...s, lastAskAt: T - 91 * DAY }, T), true);
});
t('jamais dans les 24 h après une erreur', () => {
  const s = { asks: 0, firstSeenAt: T - 10 * DAY, lastErrorAt: T - 23 * 3600_000 };
  assert.equal(R.shouldAskReview(s, T), false);
  assert.equal(R.shouldAskReview({ ...s, lastErrorAt: T - 25 * 3600_000 }, T), true);
});
t('état stocké corrompu → valeurs sûres', () => {
  assert.deepEqual(R.normalizeReview(null), { asks: 0, firstSeenAt: undefined, lastAskAt: undefined, lastErrorAt: undefined });
  assert.equal(R.normalizeReview({ asks: 'x', lastAskAt: NaN }).asks, 0);
});
console.log(`test-review OK : ${ok} tests`);
