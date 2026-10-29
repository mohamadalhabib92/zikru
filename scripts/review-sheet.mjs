// Génère la fiche de validation savante (CSV + Markdown) à remettre à un relecteur.
// Usage : node scripts/review-sheet.mjs [dossier]   (défaut : dossier parent du repo)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadLib } from './load-lib.mjs';

const outDir = resolve(process.argv[2] ?? join(import.meta.dirname, '..', '..', '..'));
const version = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo.version;
const { 'review-sheet': R } = await loadLib(['review-sheet'], 'sheet');
const rows = R.reviewRows();
writeFileSync(join(outDir, 'zikru-validation-savante.csv'), R.reviewCsv(rows));
writeFileSync(join(outDir, 'zikru-validation-savante.md'), R.reviewMarkdown(rows, version));
console.log(`${rows.length} lignes → ${join(outDir, 'zikru-validation-savante.{csv,md}')}`);
