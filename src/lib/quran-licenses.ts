/**
 * Sources et licences du texte coranique, des traductions et des récitations (module pur).
 * « verified » : licence vérifiée et citée ; « todo » : licence à confirmer par l’éditeur de l’app
 * (YOUR_QURAN_TRANSLATIONS_LICENSES) — ces contenus restent consultables comme avant, avec leur source affichée,
 * mais ne sont PAS incrustés dans les images partagées tant que la licence n’est pas confirmée.
 */
import { PLACEHOLDERS } from './app-placeholders';

export type LicStatus = 'verified' | 'todo';
export type SourceInfo = { id: string; name: string; by: string; licence: string; status: LicStatus; url: string };

export const QURAN_TEXT_SOURCE: SourceInfo = {
  id: 'tanzil-uthmani',
  name: 'Tanzil Quran Text (Uthmani / Simple)',
  by: 'Tanzil Project',
  licence: 'CC BY 3.0 — texte non modifié, source citée',
  status: 'verified',
  url: 'https://tanzil.net/docs/text_license',
};

export const TRANSLATION_SOURCES: Record<string, SourceInfo> = {
  'en.pickthall': { id: 'en.pickthall', name: 'The Meaning of the Glorious Koran', by: 'Marmaduke Pickthall (1930)', licence: 'Domaine public (publié en 1930 ; auteur décédé en 1936)', status: 'verified', url: 'https://api.alquran.cloud/v1/edition/translation' },
  'fr.hamidullah': { id: 'fr.hamidullah', name: 'Le Saint Coran', by: 'Muhammad Hamidullah', licence: PLACEHOLDERS.QURAN_TRANSLATIONS_LICENSES, status: 'todo', url: 'https://api.alquran.cloud/v1/edition/translation' },
  'de.bubenheim': { id: 'de.bubenheim', name: 'Der edle Qur’an', by: 'A. S. F. Bubenheim & N. Elyas', licence: PLACEHOLDERS.QURAN_TRANSLATIONS_LICENSES, status: 'todo', url: 'https://api.alquran.cloud/v1/edition/translation' },
  'ar.muyassar': { id: 'ar.muyassar', name: 'التفسير الميسر', by: 'Complexe du Roi Fahd', licence: PLACEHOLDERS.QURAN_TRANSLATIONS_LICENSES, status: 'todo', url: 'https://api.alquran.cloud/v1/edition/tafsir' },
  'en.transliteration': { id: 'en.transliteration', name: 'English Transliteration', by: 'alquran.cloud / Tanzil', licence: PLACEHOLDERS.QURAN_TRANSLATIONS_LICENSES, status: 'todo', url: 'https://api.alquran.cloud/v1/edition/transliteration' },
};

export const RECITATION_SOURCE: SourceInfo = {
  id: 'everyayah',
  name: 'EveryAyah.com (verset par verset)',
  by: 'Récitateurs cités dans le lecteur',
  licence: PLACEHOLDERS.QURAN_TRANSLATIONS_LICENSES,
  status: 'todo',
  url: 'https://everyayah.com',
};

export const translationSource = (id: string): SourceInfo | null => TRANSLATION_SOURCES[id] ?? null;
/** Une traduction peut-elle être incrustée dans une image partagée ? (licence vérifiée uniquement) */
export const canEmbedTranslation = (id: string) => TRANSLATION_SOURCES[id]?.status === 'verified';
