// Inventaire des chaînes d'interface codées en dur (français) dans les écrans.
// Usage : node scripts/i18n-scan.mjs [--json] [fichiers…]
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PROPS = new Set(['title', 'label', 'hint', 'text', 'subtitle', 'placeholder', 'accessibilityLabel', 'sub', 'desc', 'body', 'empty', 'cta', 'message', 'caption', 'header', 'note', 'help', 'description', 'confirm', 'ok', 'cancel']);
const ARABIC = /[\u0600-\u06FF]/;
export function looksUi(s) {
  const v = s.trim();
  if (v.length < 2) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(v)) return false;
  if (ARABIC.test(v) && !/[a-zà-ÿ]{3}/.test(v.replace(/[\u0600-\u06FF]/g, ''))) return false;
  if (/^[a-z0-9_.:\-\/@#]+$/.test(v)) return false; // ids, clés, routes
  if (/^https?:/.test(v)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return false;
  return true;
}
/** Renvoie la liste des chaînes d'UI d'un fichier : JSX texte, props textuelles, arguments de L(). */
export function extract(file) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = []; // {s, kind, wrapped}
  const add = (s, kind, node, wrapped) => { if (looksUi(s)) out.push({ s: s.replace(/\s+/g, ' ').trim(), kind, wrapped, line: src.getLineAndCharacterOfPosition(node.getStart()).line + 1 }); };
  const isL = (n) => n && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 'L' || n.expression.text === 'Lf');
  const visit = (n) => {
    if (ts.isImportDeclaration(n)) return;
    if (ts.isJsxText(n)) add(n.text, 'jsx', n, false);
    else if (ts.isJsxAttribute(n) && n.initializer && PROPS.has(n.name.getText())) {
      const i = n.initializer;
      if (ts.isStringLiteral(i)) add(i.text, 'prop', i, false);
      else if (ts.isJsxExpression(i) && i.expression && (ts.isStringLiteral(i.expression) || ts.isNoSubstitutionTemplateLiteral(i.expression))) add(i.expression.text, 'prop', i, false);
    } else if (ts.isJsxExpression(n) && n.expression && (ts.isStringLiteral(n.expression) || ts.isNoSubstitutionTemplateLiteral(n.expression)) && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) add(n.expression.text, 'jsx', n, false);
    else if (isL(n) && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) { out.push({ s: n.arguments[0].text, kind: 'L', wrapped: true, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 }); return; }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}
export function walk(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) ? [p] : []; });
}
if (process.argv[1] && process.argv[1].endsWith('i18n-scan.mjs') && !process.argv.includes('--deep')) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const files = args.length ? args : [...walk('src/app'), ...walk('src/components'), ...walk('src/ui')];
  let tot = 0, wr = 0;
  const rows = files.map((f) => { const e = extract(f); const w = e.filter((x) => x.wrapped).length; tot += e.length; wr += w; return { f, n: e.length, w }; }).filter((r) => r.n);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows));
  else { for (const r of rows.sort((a, b) => b.n - a.n)) console.log(String(r.n).padStart(4), String(r.w).padStart(4), r.f); console.log('TOTAL', tot, 'dont via L()', wr); }
}
// Mode large : toute chaîne littérale « phrase française » (hors imports, styles, clés techniques).
const SKIPKEYS = new Set(['id', 'icon', 'name', 'href', 'pathname', 'key', 'cat', 'kind', 'set', 'route', 'testID', 'fontFamily', 'color', 'uid', 'edition', 'url', 'ar', 'textAr', 'tr', 'ref', 'arabic']);
export function looksFrench(s) {
  const v = s.trim();
  if (!looksUi(v) || ARABIC.test(v)) return false;
  return /\s/.test(v) || /[À-ÿ’]/.test(v) || /^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(v);
}
export function extractDeep(file) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  const visit = (n, inL) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isPropertyAssignment(n) && (SKIPKEYS.has(n.name.getText()) || n.name.getText() === 'style')) return;
    if (ts.isJsxAttribute(n) && (n.name.getText() === 'style' || SKIPKEYS.has(n.name.getText()))) return;
    if (ts.isBinaryExpression(n) && /===|!==|==|!=/.test(n.operatorToken.getText())) return;
    if (ts.isCaseClause(n)) { n.statements.forEach((c) => visit(c, inL)); return; }
    const isL = ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 'L' || n.expression.text === 'Lf');
    if (ts.isCallExpression(n) && /^(console|router|AsyncStorage|storage|require|fetch)\b|\.(push|replace|getItem|setItem|includes|startsWith|endsWith|split|join|replace|match|test|navigate)$/.test(n.expression.getText()) && !isL) return;
    if (ts.isJsxText(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const t = n.text ?? n.getText();
      if (looksFrench(t)) out.push({ s: t.replace(/\s+/g, ' ').trim(), wrapped: !!inL, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
      return;
    }
    if (ts.isTemplateExpression(n)) {
      const parts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' {} ');
      if (looksFrench(parts.replace(/\{\}/g, ''))) out.push({ s: parts, wrapped: !!inL, tpl: true, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
      n.templateSpans.forEach((s) => visit(s.expression, inL));
      return;
    }
    ts.forEachChild(n, (c) => visit(c, inL || isL));
  };
  visit(src, false);
  return out;
}
if (process.argv.includes('--deep')) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const files = args.length ? args : [...walk('src/app'), ...walk('src/components'), ...walk('src/ui')];
  let tot = 0, wr = 0;
  const rows = files.map((f) => { const e = extractDeep(f); const w = e.filter((x) => x.wrapped).length; tot += e.length; wr += w; return { f, n: e.length, w, e }; }).filter((r) => r.n);
  if (process.argv.includes('--dump')) for (const r of rows) for (const x of r.e) console.log(`${r.f}:${x.line}\t${x.wrapped ? 'OK' : '--'}\t${x.s}`);
  else { for (const r of rows.sort((a, b) => b.n - a.n)) console.log(String(r.n).padStart(4), String(r.w).padStart(4), r.f); console.log('TOTAL', tot, 'traduites', wr); }
}
