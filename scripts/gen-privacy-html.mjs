// Régénère public/privacy/index.html (fr / en / ar) depuis src/lib/privacy-policy.ts.
import { writeFileSync } from 'node:fs';
import { policyHtml, PRIVACY_HTML_PATH } from './privacy-html.mjs';
writeFileSync(PRIVACY_HTML_PATH, await policyHtml());
console.log('✓ public/privacy/index.html régénéré');
