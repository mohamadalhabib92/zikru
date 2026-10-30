import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { joinLines, type OcrLine, type OcrResult, type OcrSupport } from './ocr-types';

export type { OcrResult, OcrSupport } from './ocr-types';

/** Module local modules/zikru-ocr (Apple Vision). Absent tant qu’un build natif ne l’inclut pas. */
type Native = { supportedLanguages(): string[]; recognize(uri: string, langs: string[]): Promise<{ lines: OcrLine[] }> };
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Native>('ZikruOcr') : null;
const ARABIC = ['ar-SA', 'ars-SA'];

export function ocrSupport(): OcrSupport {
  // Android : ML Kit (reconnaissance de texte sur l’appareil) ne prend pas en charge l’écriture arabe.
  if (Platform.OS !== 'ios') return { ok: false, reason: 'android' };
  if (!native) return { ok: false, reason: 'needs-build' };
  let all: string[] = [];
  try {
    all = native.supportedLanguages();
  } catch {}
  const langs = ARABIC.filter((l) => all.includes(l));
  return langs.length ? { ok: true, langs } : { ok: false, reason: 'no-arabic' };
}

export async function recognizeArabic(uri: string): Promise<OcrResult> {
  const s = ocrSupport();
  if (!s.ok || !native) throw new Error('ocr-unsupported');
  const r = await native.recognize(uri, s.langs);
  return joinLines(r.lines ?? []);
}

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
