// Copie pdf.js (Apache-2.0) de node_modules vers public/pdfjs : servi localement, aucune requête externe.
import { copyFileSync, mkdirSync } from 'node:fs';
const src = 'node_modules/pdfjs-dist/';
mkdirSync('public/pdfjs', { recursive: true });
for (const f of ['legacy/build/pdf.min.mjs', 'legacy/build/pdf.worker.min.mjs', 'LICENSE']) copyFileSync(src + f, 'public/pdfjs/' + f.split('/').pop());
console.log('pdf.js copié dans public/pdfjs');
