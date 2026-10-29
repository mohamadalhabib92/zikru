// Génère la fiche de validation savante (CSV + Markdown) à remettre à un relecteur.
// Usage : node scripts/review-sheet.mjs [dossier]   (défaut : dossier parent du repo)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadLib } from './load-lib.mjs';

const outDir = resolve(process.argv[2] ?? join(import.meta.dirname, '..', '..', '..'));
const version = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo.version;
const { 'review-sheet': R } = await loadLib(['review-sheet'], 'sheet');
const rows = R.reviewRows();
writeFileSync(join(outDir, 'zikru-validation-savante.csv'), R.reviewCsv(rows));
writeFileSync(join(outDir, 'zikru-validation-savante.md'), R.reviewMarkdown(rows, version));
console.log(`${rows.length} lignes → ${join(outDir, 'zikru-validation-savante.{csv,md}')}`);

// Interface : catalogue fr → en/ar (i18n/*.tsv), entièrement « traduction à relire » (P5).
const tsv = readdirSync(new URL('../i18n/', import.meta.url)).filter((f) => f.endsWith('.tsv')).sort();
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
const ui = ['Fichier;Français (clé);English;العربية;Statut;Avis du relecteur;Correction proposée'];
let n = 0;
for (const f of tsv)
  for (const line of readFileSync(new URL('../i18n/' + f, import.meta.url), 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [fr, en = '', ar = ''] = line.split('\t');
    ui.push([f, fr, en, ar, 'traduction à relire', '', ''].map(q).join(';'));
    n++;
  }
writeFileSync(join(outDir, 'zikru-traduction-interface.csv'), '\uFEFF' + ui.join('\r\n') + '\r\n');
console.log(`${n} chaînes d’interface → ${join(outDir, 'zikru-traduction-interface.csv')}`);
