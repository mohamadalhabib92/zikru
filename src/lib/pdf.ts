/**
 * PDF sur le web : pdf.js (Mozilla, Apache-2.0), servi par l’app elle-même depuis /pdfjs (aucun CDN).
 * Le fichier est lu dans le navigateur ; rien n’est envoyé. Les pages scannées ne peuvent pas être lues ici
 * (pas de reconnaissance de texte arabe sur le web) : elles sont seulement affichées.
 */
import { brokenGlyphs, itemsToLines, type TextPiece } from './pdf-lines';
import { MAX_BYTES, MAX_PAGES, type PdfDoc, type PdfSupport } from './pdf-types';

export type { PdfDoc, PdfSupport } from './pdf-types';

type PdfJs = any;
let lib: Promise<PdfJs> | null = null;
function pdfjs(): Promise<PdfJs> {
  if (!lib) {
    const base = String(process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
    const at = (f: string) => new URL(`${base}/pdfjs/${f}`, window.location.href).href;
    // import() à l’exécution : Metro ne doit pas embarquer pdf.js dans le bundle de l’app.
    const load = new Function('u', 'return import(u)') as (u: string) => Promise<PdfJs>;
    // Chargé à la demande (premier PDF importé), jamais pré-caché : hors connexion, erreur « pdf-offline ».
    lib = load(at('pdf.min.mjs')).catch(() => {
      throw new Error('pdf-offline');
    }).then((m) => {
      m.GlobalWorkerOptions.workerSrc = at('pdf.worker.min.mjs');
      return m;
    });
    lib.catch(() => (lib = null));
  }
  return lib;
}

export function pdfSupport(): PdfSupport {
  return { text: true, render: true, ocr: false, reason: 'web-ocr' };
}

export async function openPdf(uri: string): Promise<PdfDoc> {
  const m = await pdfjs();
  const data = new Uint8Array(await (await fetch(uri)).arrayBuffer());
  if (data.byteLength > MAX_BYTES) throw new Error('pdf-too-big');
  const doc = await m.getDocument({ data, isEvalSupported: false, enableXfa: false }).promise;
  const pages: string[] = [];
  const unreadable: boolean[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pieces: TextPiece[] = (tc.items as any[])
      .filter((it) => typeof it.str === 'string')
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0, h: it.height || Math.hypot(it.transform[2], it.transform[3]) || 10 }));
    const broken = brokenGlyphs(pieces);
    unreadable.push(broken);
    pages.push(broken ? '' : itemsToLines(pieces).join('\n'));
  }
  return { pages, unreadable, total: doc.numPages, handle: doc };
}

/** Rendu d’une page (aperçu) : URL data JPEG, ou null si impossible. */
export async function renderPdfPage(doc: PdfDoc, index: number, maxSide = 1100): Promise<string | null> {
  try {
    const pdf = doc.handle as any;
    const page = await pdf.getPage(index + 1);
    const v1 = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: maxSide / Math.max(v1.width, v1.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

/** Reconnaissance de texte d’une page scannée : indisponible sur le web. */
export async function ocrPdfPage(_doc: PdfDoc, _index: number): Promise<string> {
  throw new Error('ocr-unsupported');
}

export function closePdf(doc: PdfDoc | null): void {
  try {
    (doc?.handle as any)?.destroy?.();
  } catch {}
}
