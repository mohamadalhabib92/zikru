import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadLib } from './load-lib.mjs';

const { 'web-checkout': C } = await loadLib(['web-checkout']);

assert.deepEqual(C.webCheckoutStatus({}), { enabled: false, chargeable: false, reason: 'off' });
assert.deepEqual(C.webCheckoutStatus({ flag: '0' }), { enabled: false, chargeable: false, reason: 'off' });
assert.deepEqual(C.webCheckoutStatus({ flag: '1' }), { enabled: true, chargeable: false, reason: 'no-key' });
assert.equal(C.webCheckoutStatus({ flag: '1', publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY' }).reason, 'placeholder');
assert.equal(C.webCheckoutStatus({ flag: '1', publishableKey: 'sk_test_abcdefghij' }).reason, 'secret-key');
assert.equal(C.webCheckoutStatus({ flag: '1', publishableKey: 'pk_test_abcdefghij' }).reason, 'not-wired');
assert.equal(C.webCheckoutStatus({ flag: '1', publishableKey: 'pk_test_abcdefghij' }).chargeable, false);
assert.equal(C.webCheckoutStatus({ flag: '1', publishableKey: 'pk_live_abcdefghij' }).chargeable, false);

const live = ['pk', 'live', 'abcdefghij'].join('_');
assert.equal(C.sourceHasStripeSecret('const k = "' + live + '"'), true);
assert.equal(C.sourceHasStripeSecret('voir la doc, sans clé'), false);

const skip = new Set(['node_modules', 'dist', '.git', '.expo']);
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?|mjs|json|md|html|yml)$/.test(name)) files.push(p);
  }
}
walk('.');
const hits = [];
for (const f of files) {
  if (f.endsWith('scripts/test-web-checkout.mjs') || f.endsWith('src/lib/web-checkout.ts')) continue;
  const text = readFileSync(f, 'utf8');
  if (C.sourceHasStripeSecret(text)) hits.push(f);
}
assert.deepEqual(hits, [], 'clé Stripe live écrite dans ' + hits.join(', '));
assert.equal(files.some((f) => f.endsWith('src/lib/premium-store.ts')), true);

console.log('test-web-checkout OK');
