/** Partage d’un verset en image (iOS/Android) : nécessite un module natif de capture (react-native-view-shot) absent de ce build. */
export const VERSE_IMAGE_SUPPORTED = false;
export type VerseCard = { s: number; a: number; ar: string; surahName: string; tr?: string; trSource?: string; textSource: string; brand: string };
export async function shareVerseImage(_c: VerseCard, _dark: boolean): Promise<'shared' | 'downloaded' | 'unsupported'> {
  return 'unsupported';
}
