/**
 * PDF sur iOS : PDFKit via le module local modules/zikru-ocr (texte encodé + rendu des pages),
 * puis Apple Vision pour les pages scannées. Tout se passe sur l’appareil. Android : non pris en charge pour l’instant.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { ocrSupport, recognizeArabic } from './ocr';
import { ocrToLines } from './ocr-lines';
import { brokenGlyphs, cleanLine } from './pdf-lines';
import { MAX_PAGES, type PdfDoc, type PdfSupport } from './pdf-types';

export type { PdfDoc, PdfSupport } from './pdf-types';

type Native = {
  pdfPages?: (uri: string) => Promise<{ pages: string[] }>;
  pdfRender?: (uri: string, index: number, maxSide: number) => Promise<string>;
};
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Native>('ZikruOcr') : null;
const hasPdf = () => !!native && typeof native.pdfPages === 'function' && typeof native.pdfRender === 'function';

export function pdfSupport(): PdfSupport {
  if (Platform.OS !== 'ios') return { text: false, render: false, ocr: false, reason: 'android' };
  if (!hasPdf()) return { text: false, render: false, ocr: false, reason: 'needs-build' };
  return { text: true, render: true, ocr: ocrSupport().ok };
}

export async function openPdf(uri: string): Promise<PdfDoc> {
  if (!hasPdf() || !native?.pdfPages) throw new Error('pdf-unsupported');
  const r = await native.pdfPages(uri);
  const all = r.pages ?? [];
  const raw = all.slice(0, MAX_PAGES);
  // Texte PDFKit illisible (glyphes arabes sans correspondance) → page traitée comme scannée, jamais devinée.
  const unreadable = raw.map((p) => brokenGlyphs([{ str: p }]));
  const pages = raw.map((p, i) => (unreadable[i] ? '' : p.split(/\r\n?|\n/).map(cleanLine).filter(Boolean).join('\n')));
  return { pages, unreadable, total: all.length, handle: uri };
}

export async function renderPdfPage(doc: PdfDoc, index: number, maxSide = 1600): Promise<string | null> {
  try {
    return native?.pdfRender ? await native.pdfRender(String(doc.handle), index, maxSide) : null;
  } catch {
    return null;
  }
}

/** Page scannée : rendu en image (haute définition) puis lecture Apple Vision, lignes de haut en bas. */
export async function ocrPdfPage(doc: PdfDoc, index: number): Promise<string> {
  const img = native?.pdfRender ? await native.pdfRender(String(doc.handle), index, 2400) : null;
  if (!img) throw new Error('pdf-render');
  const r = await recognizeArabic(img);
  return ocrToLines(r.lines).join('\n');
}

export function closePdf(_doc: PdfDoc | null): void {}
