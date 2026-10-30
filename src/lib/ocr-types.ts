/** Reconnaissance de texte (photo → texte), toujours sur l’appareil. */
export type OcrSupport = { ok: true; langs: string[] } | { ok: false; reason: 'web' | 'android' | 'needs-build' | 'no-arabic' };
export type OcrLine = { text: string; confidence: number };
export type OcrResult = { text: string; lines: OcrLine[]; minConfidence: number };

/** Assemble les lignes reconnues sans les corriger (aucune « amélioration » du texte). */
export function joinLines(lines: OcrLine[]): OcrResult {
  const kept = lines.filter((l) => l.text.trim());
  return {
    text: kept.map((l) => l.text.trim()).join('\n'),
    lines: kept,
    minConfidence: kept.length ? Math.min(...kept.map((l) => l.confidence)) : 0,
  };
}
