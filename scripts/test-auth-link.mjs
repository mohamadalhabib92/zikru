// Tests du retour des liens magiques : erreurs Supabase (requête et fragment #), code PKCE, messages clairs.
import assert from 'node:assert/strict';
import { loadLib } from './load-lib.mjs';

const { 'auth-link': A } = await loadLib(['auth-link'], 'authlink');
const bad =
  'http://localhost:3000/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';
let r = A.parseAuthReturn(bad);
assert.equal(r.errorCode, 'otp_expired');
assert.equal(r.error, 'Email link is invalid or has expired');
assert.match(A.linkErrorMessage(r.errorCode, r.error), /^Lien expiré ou déjà utilisé/);
r = A.parseAuthReturn('https://mohamadalhabib92.github.io/zikru/auth-callback#error=access_denied&error_code=otp_expired&error_description=x');
assert.equal(r.errorCode, 'otp_expired');
r = A.parseAuthReturn('zikru://auth-callback?code=abc-123');
assert.deepEqual(r, { code: 'abc-123' });
r = A.parseAuthReturn('https://mohamadalhabib92.github.io/zikru/community');
assert.deepEqual(r, {});
assert.match(A.linkErrorMessage(undefined, 'invalid flow state, no valid flow state found'), /autre appareil/);
assert.match(A.linkErrorMessage(undefined, 'code verifier should be non-empty'), /autre appareil/);
assert.match(A.linkErrorMessage('server_error', 'boom'), /n’a pas fonctionné/);
console.log('test-auth-link OK');
