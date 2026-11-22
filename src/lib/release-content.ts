/**
 * Porte de la version App Store (profils EAS `production` et `production-tv`).
 * `EXPO_PUBLIC_STORE_RELEASE=1` masque les sources sans licence confirmée.
 * Le texte reste dans le dépôt : on ne l’efface pas, on ne le demande plus.
 * Sans ce drapeau (développement, tests), tout reste proposé.
 */
export function storeRelease(flag: string | undefined = process.env.EXPO_PUBLIC_STORE_RELEASE): boolean {
  return flag === '1';
}

/** Les cinq sources à ne pas montrer tant que la licence n’est pas confirmée. */
export const GATED_LICENCE_SOURCES = [
  { id: 'quranenc', label: 'Traductions QuranEnc' },
  { id: 'kfgqpc-text-font', label: 'Textes et polices du Complexe du Roi Fahd (KFGQPC), dont At-Tafsir al-Muyassar' },
  { id: 'tanzil-transliteration', label: 'Translittération Tanzil (licence non commerciale)' },
  { id: 'ibn-kathir-en', label: 'Ibn Kathir abrégé en anglais' },
  { id: 'kfgqpc-tajwid', label: 'Tajwid KFGQPC (QPC Hafs, QUL)' },
] as const;

export type GatedSourceId = (typeof GATED_LICENCE_SOURCES)[number]['id'];

export function sourceAllowed(id: GatedSourceId, release = storeRelease()): boolean {
  return release ? false : true;
}

const KFGQPC_FONT = /kfgqpc|qpc|uthmanic|qurancomplex|king\s*fahd/i;

/** Amiri reste. Une police du Complexe du Roi Fahd ne s’affiche pas dans la version App Store. */
export function fontFamilyAllowed(family: string | null | undefined, release = storeRelease()): boolean {
  if (!family || !release) return true;
  return !KFGQPC_FONT.test(family);
}

/** Édition de sens ou de translittération que le réseau et le cache peuvent encore montrer. */
export function editionFetchAllowed(edition: string, release = storeRelease()): boolean {
  if (!release) return true;
  if (edition.startsWith('qe:')) return false;
  if (edition === 'ar.muyassar' || edition === 'en.transliteration') return false;
  return true;
}

/** Tafsir encore proposé. Muyassar = Complexe du Roi Fahd. ibnkathir = abrégé anglais. */
export function tafsirAllowed(id: string, release = storeRelease()): boolean {
  if (!release) return true;
  return id !== 'muyassar' && id !== 'ibnkathir';
}

/** La source QUL / QPC Hafs ne s’affiche pas dans la version App Store. */
export function tajwidSourceVisible(id: string, release = storeRelease()): boolean {
  if (id === 'qul-qpc' && !sourceAllowed('kfgqpc-tajwid', release)) return false;
  return true;
}

/** Pastilles « Exemple » et le mot « (exemple) » sur un lieu de démonstration. */
export function showExampleMarks(release = storeRelease()): boolean {
  return !release;
}

export function examplePlaceMark(source: string | undefined, release = storeRelease()): string {
  return source === 'example' && showExampleMarks(release) ? ' (exemple)' : '';
}
