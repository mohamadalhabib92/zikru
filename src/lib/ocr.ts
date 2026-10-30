import type { OcrResult, OcrSupport } from './ocr-types';

export type { OcrResult, OcrSupport } from './ocr-types';

/**
 * Web (PWA) : pas de reconnaissance de texte intégrée.
 * Tesseract.js (« ara ») a été écarté : plusieurs Mo téléchargés depuis un CDN tiers, lent sur téléphone,
 * et peu fiable sur l’arabe vocalisé ou calligraphié. On propose plutôt Texte en direct (iOS) / Google Lens, puis « Coller ».
 */
export function ocrSupport(): OcrSupport {
  return { ok: false, reason: 'web' };
}
export async function recognizeArabic(_uri: string): Promise<OcrResult> {
  throw new Error('ocr-unsupported');
}
export function keepPhoto(_uri: string): string | undefined {
  return undefined;
}
export function prunePhotos(_used: string[]): void {}
