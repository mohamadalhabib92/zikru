/** Import de PDF (programmes de zikr) : tout reste sur l’appareil, aucun fichier n’est envoyé. */
export type PdfSupport = {
  /** Lecture du texte encodé dans le PDF. */
  text: boolean;
  /** Rendu des pages en image (aperçu de la source). */
  render: boolean;
  /** Reconnaissance de texte sur les pages scannées. */
  ocr: boolean;
  /** Raison d’une limite (message honnête à l’écran). */
  reason?: 'android' | 'needs-build' | 'web-ocr';
};
export type PdfDoc = {
  /** Texte de chaque page, une ligne par ligne lue ("" pour une page sans texte encodé, ex. scannée). */
  pages: string[];
  /** Pages dont le texte encodé est illisible (glyphes arabes sans correspondance) : à lire comme une image. */
  unreadable?: boolean[];
  /** Nombre total de pages du fichier (seules les MAX_PAGES premières sont lues). */
  total: number;
  /** Poignée interne (pdf.js sur le web, URI locale sur iOS). */
  handle: unknown;
};
export const MAX_PAGES = 40;
export const MAX_BYTES = 40 * 1024 * 1024;
/** Une page n’a pas de texte exploitable (page scannée ou dessinée) ? */
export const pageIsScanned = (s: string) => !/[\p{L}\p{N}]/u.test(s);
