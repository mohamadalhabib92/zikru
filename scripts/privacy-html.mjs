// Rendu de la page publique public/privacy/index.html à partir de src/lib/privacy-policy.ts (source unique).
import ts from 'typescript';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Transpile des modules de src/lib vers un dossier temporaire DANS le projet (résolution des paquets). */
export async function loadLib(names, stubs = {}) {
  const base = join(root, 'node_modules', '.cache');
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, 'zikru-test-'));
  for (const [name, code] of Object.entries(stubs)) writeFileSync(join(dir, name + '.mjs'), code);
  for (const name of names) {
    const src = readFileSync(join(root, 'src/lib', name + '.ts'), 'utf8').replace(/from '\.\/(\w[\w-]*)'/g, "from './$1.mjs'");
    writeFileSync(join(dir, name + '.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
  }
  return dir;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s) => esc(s).replace(/(https:\/\/[^\s)]+[^\s).,;:])/g, '<a href="$1">$1</a>').replace(/\b(www\.edoeb\.admin\.ch)\b/g, '<a href="https://$1">$1</a>');

export function renderPolicyHtml(POLICY) {
  const langs = [['fr', 'Français'], ['en', 'English'], ['ar', 'العربية']];
  const body = langs
    .map(([l]) => {
      const p = POLICY[l];
      const secs = p.sections
        .map((s) => `<h2 id="${l}-${s.id}">${esc(s.h)}</h2>\n${(s.p ?? []).map((x) => `<p>${linkify(x)}</p>`).join('\n')}${s.li ? `\n<ul>\n${s.li.map((x) => `<li>${linkify(x)}</li>`).join('\n')}\n</ul>` : ''}`)
        .join('\n');
      return `<section id="${l}" lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}">\n<h1>${esc(p.title)}</h1>\n<p class="m">${esc(p.updated)}</p>\n${p.prevails ? `<p class="m"><em>${esc(p.prevails)}</em></p>\n` : ''}<p>${linkify(p.lead)}</p>\n${secs}\n</section>`;
    })
    .join('\n<hr>\n');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confidentialité — Zikru</title><meta name="robots" content="index,follow"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:760px;margin:0 auto;padding:24px 18px 64px;line-height:1.6;color:#1d2a24;background:#fbf8f1}h1{font-size:1.6em;margin-top:1.2em}h2{font-size:1.15em;margin-top:1.6em}.m{color:#5b6b63;margin:.2em 0}nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}a{color:#1f6b4f}[dir=rtl]{text-align:right}hr{border:0;border-top:1px solid #ddd;margin:40px 0}</style></head><body>
<!-- Généré par scripts/gen-privacy-html.mjs depuis src/lib/privacy-policy.ts — ne pas modifier à la main. -->
<nav>${langs.map(([l, n]) => `<a href="#${l}" hreflang="${l}">${n}</a>`).join('')}<a href="../support/">Assistance</a></nav>
${body}
</body></html>
`;
}

export async function policyHtml() {
  const dir = await loadLib(['privacy', 'privacy-policy']);
  const { POLICY } = await import(join(dir, 'privacy-policy.mjs'));
  return renderPolicyHtml(POLICY);
}

export const PRIVACY_HTML_PATH = join(root, 'public/privacy/index.html');
