/** Lignes reconnues (Apple Vision) → lignes de texte : morceaux d’une même ligne regroupés si leurs positions sont connues. */
import { itemsToLines } from './pdf-lines';
import type { OcrLine } from './ocr-types';

export function ocrToLines(lines: OcrLine[]): string[] {
  const kept = lines.filter((l) => l.text.trim());
  if (kept.length && kept.every((l) => Array.isArray(l.box) && l.box.length === 4)) {
    return itemsToLines(kept.map((l) => ({ str: l.text, x: l.box![0], y: l.box![1], w: l.box![2], h: l.box![3] })));
  }
  return kept.map((l) => l.text.trim());
}
