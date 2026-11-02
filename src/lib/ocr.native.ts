import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { mergePasses, planLanguages } from './ocr-merge';
import { joinLines, type OcrLine, type OcrResult, type OcrSupport } from './ocr-types';

export type { OcrResult, OcrSupport } from './ocr-types';

/** Module local modules/zikru-ocr (Apple Vision). Absent tant qu’un build natif ne l’inclut pas. */
type Native = {
  supportedLanguages(): string[];
  recognize(uri: string, langs: string[]): Promise<{ lines: OcrLine[] }>;
  /** Builds ≥ 1.0.29 : détection automatique de la langue (iOS 16+). */
  recognizeWith?: (uri: string, langs: string[], autoDetect: boolean) => Promise<{ lines: OcrLine[] }>;
};
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Native>('ZikruOcr') : null;

function supported(): string[] {
  try {
    return native?.supportedLanguages() ?? [];
  } catch {
    return [];
  }
}

export function ocrSupport(): OcrSupport {
  // Android : ML Kit (reconnaissance de texte sur l’appareil) ne prend pas en charge l’écriture arabe.
  if (Platform.OS !== 'ios') return { ok: false, reason: 'android' };
  if (!native) return { ok: false, reason: 'needs-build' };
  const plan = planLanguages(supported());
  // Ancien build (sans détection automatique) : seule la passe arabe est possible.
  if (typeof native.recognizeWith !== 'function') return plan.arabic.length ? { ok: true, langs: plan.arabic, arabic: true } : { ok: false, reason: 'no-arabic' };
  return { ok: true, langs: [...plan.arabic, ...plan.others], arabic: plan.arabic.length > 0 };
}

const pass = async (uri: string, langs: string[], auto: boolean): Promise<OcrLine[]> => {
  if (!native) return [];
  const r = native.recognizeWith ? await native.recognizeWith(uri, langs, auto) : await native.recognize(uri, langs);
  return r.lines ?? [];
};

/**
 * Lecture sur l’appareil, quelle que soit la langue : passe arabe (si l’appareil la propose), puis passe
 * « autres langues » en détection automatique, fusionnées ligne par ligne (mergePasses). Rien n’est envoyé.
 */
export async function recognizeText(uri: string): Promise<OcrResult> {
  const s = ocrSupport();
  if (!s.ok || !native) throw new Error('ocr-unsupported');
  const plan = planLanguages(supported());
  const a = plan.arabic.length ? await pass(uri, plan.arabic, false).catch(() => [] as OcrLine[]) : [];
  const b = native.recognizeWith ? await pass(uri, plan.others, true).catch(() => [] as OcrLine[]) : [];
  return joinLines(mergePasses(a, b));
}
/** Ancien nom (lecture de l’arabe seule) : désormais multilingue. */
export const recognizeArabic = recognizeText;

/** Copie la photo dans Documents/zikr-photos (jamais envoyée ni partagée) et renvoie son URI locale. */
const dir = () => {
  const d = new Directory(Paths.document, 'zikr-photos');
  if (!d.exists) d.create();
  return d;
};
export function keepPhoto(uri: string): string | undefined {
  try {
    const src = new File(uri);
    const dst = new File(dir(), `p-${Date.now().toString(36)}.jpg`);
    src.copy(dst);
    return dst.uri;
  } catch {
    return undefined;
  }
}
/** Supprime les photos qui ne sont plus utilisées par aucun élément. */
export function prunePhotos(used: string[]): void {
  try {
    const keep = new Set(used);
    for (const f of dir().list()) if (f instanceof File && !keep.has(f.uri)) f.delete();
  } catch {}
}
