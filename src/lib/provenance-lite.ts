/**
 * Provenance — partie légère (libellés, liens) : importable partout sans charger les données sourcées.
 * Passe 6 : séparée de provenance.ts (qui agrège du‘as, hadiths, jugements…) pour alléger le chargement initial.
 */
import type { GradeClass, ProvenanceSet } from './provenance-types';

/** Lien de recherche dorar.net (encyclopédie des hadiths) pour un texte arabe. */
export function dorarSearchUrl(arabic: string): string {
  const q = arabic.replace(/[\u064B-\u0652\u0670]/g, '').split(/\s+/).slice(0, 6).join(' ');
  return `https://dorar.net/hadith/search?q=${encodeURIComponent(q)}`;
}

export const GRADE_LABEL: Record<GradeClass, string> = {
  sahih: 'Ṣaḥīḥ',
  hasan_sahih: 'Ḥasan ṣaḥīḥ',
  hasan: 'Ḥasan',
  hasan_li_ghayrihi: 'Ḥasan li-ghayrihi',
  sahih_isnad: 'Isnad ṣaḥīḥ',
  hasan_isnad: 'Isnad ḥasan',
  daif_isnad: 'Isnad ḍa‘īf',
  daif: 'Ḍa‘īf',
  mawdu: 'Mawḍū‘',
  autre: 'Autre',
};

export function gradeTone(g: GradeClass): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  if (g === 'sahih' || g === 'hasan_sahih' || g === 'sahih_isnad') return 'success';
  if (g === 'hasan' || g === 'hasan_li_ghayrihi' || g === 'hasan_isnad') return 'info';
  if (g === 'daif' || g === 'daif_isnad') return 'warning';
  if (g === 'mawdu') return 'danger';
  return 'neutral';
}

export const SET_LABEL: Record<ProvenanceSet, string> = {
  duas: 'Du‘as & adhkar',
  hadiths: 'Hadiths',
  salawat: 'Salawat',
  adilla: 'Preuves (Tijaniyya)',
  tijani: 'Formules tijanies',
  names: 'Noms d’Allah',
  'quran-duas': 'Du‘as coraniques',
};

export const REPORT_EMAIL = 'mohamadalhabib@live.com';
export function reportUrl(uid: string, title: string, version: string): string {
  const subject = `[Zikru] Erreur – ${uid}`;
  const body = `Élément : ${title} (${uid})\nVersion : ${version}\n\nErreur constatée (texte, traduction, source ou jugement) :\n\nSource à l’appui (livre, numéro, lien) :\n`;
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
