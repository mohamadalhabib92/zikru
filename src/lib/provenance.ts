/**
 * Registre de provenance : relie chaque texte de l’app à ses sources (hadith, Coran, tradition) et aux
 * jugements VÉRIFIÉS (gradings.gen.ts, recopiés depuis sunnah.com / dorar.net). Ne modifie pas les données
 * d’origine : les références existantes sont analysées telles quelles.
 */
import { DUAS_LIST } from './duas';
import { GRADINGS_CHECKED_AT, HADITH_CHECKS } from './gradings.gen';
import { HADITHS } from './knowledge';
import { NAMES_REF } from './names';
import type { GradeClass, ProvenanceItem, ProvenanceSet, SourceRef, VerifiedGrading } from './provenance-types';
import { QURAN_DUAS } from './quran-duas';
import { reviewFor } from './reviews';
import { SALAWAT } from './salawat';
import { ADILLA, FORMULAS } from './tijani';

export { GRADINGS_CHECKED_AT };

/** Nombre de versets par sourate (édition de Médine, 6236 versets). */
export const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

const COLLECTIONS: [RegExp, string, string][] = [
  [/(?:Sahih al-Bukhari|al-Bukhārī|Bukhari)\s+(\d+)/g, 'bukhari', 'Ṣaḥīḥ al-Bukhārī'],
  [/(?:Sahih Muslim|Muslim)\s+(\d+)/g, 'muslim', 'Ṣaḥīḥ Muslim'],
  [/Sunan Abi Dawud\s+(\d+)/g, 'abudawud', 'Sunan Abī Dāwūd'],
  [/(?:Jami‘ at-Tirmidhi|at-Tirmidhī)\s+(\d+)/g, 'tirmidhi', 'Jāmi‘ at-Tirmidhī'],
  [/Sunan Ibn Majah\s+(\d+)/g, 'ibnmajah', 'Sunan Ibn Mājah'],
  [/Musnad Ahmad\s+(\d+)/g, 'ahmad', 'Musnad Aḥmad'],
];

/** Extrait les sources structurées d’une référence textuelle de l’app. */
export function parseRef(ref: string): SourceRef[] {
  const out: SourceRef[] = [];
  for (const [rx, c, name] of COLLECTIONS) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(ref))) {
      const key = `${c}:${m[1]}`;
      if (!out.some((s) => s.key === key))
        out.push({ kind: 'hadith', label: `${name} ${m[1]}`, collection: c, number: Number(m[1]), key, url: `https://sunnah.com/${c}:${m[1]}` });
    }
  }
  const qx = /Coran\s+(\d+):(\d+)(?:-(\d+))?/g;
  let q: RegExpExecArray | null;
  while ((q = qx.exec(ref))) out.push(quranRef(Number(q[1]), Number(q[2]), q[3] ? Number(q[3]) : undefined));
  if (/Tradition tijanie/i.test(ref)) out.push({ kind: 'tariqa', label: 'Tradition de la Ṭarīqa Tijāniyya (non issue d’un hadith)' });
  if (/Formule usuelle/i.test(ref)) out.push({ kind: 'usage', label: 'Formule usuelle (application de l’ordre coranique)' });
  return out;
}

export function quranRef(surah: number, ayah: number, ayahEnd?: number): SourceRef {
  return {
    kind: 'coran',
    label: `Coran ${surah}:${ayah}${ayahEnd ? '-' + ayahEnd : ''}`,
    surah,
    ayah,
    ayahEnd,
    url: `https://quran.com/${surah}/${ayah}${ayahEnd ? '-' + ayahEnd : ''}`,
  };
}

/** Lien de recherche dorar.net (encyclopédie des hadiths) pour un texte arabe. */
export function dorarSearchUrl(arabic: string): string {
  const q = arabic.replace(/[\u064B-\u0652\u0670]/g, '').split(/\s+/).slice(0, 6).join(' ');
  return `https://dorar.net/hadith/search?q=${encodeURIComponent(q)}`;
}

function build(set: ProvenanceSet, id: string, title: string, refText: string, extra: Partial<ProvenanceItem>, sources = parseRef(refText)): ProvenanceItem {
  const gradings: (VerifiedGrading & { key: string })[] = [];
  let divergence = false;
  let missing = false;
  for (const s of sources) {
    if (s.kind !== 'hadith' || !s.key) continue;
    const c = HADITH_CHECKS[s.key];
    if (!c || !c.gradings.length) {
      missing = true;
      continue;
    }
    divergence = divergence || c.divergence;
    for (const g of c.gradings) gradings.push({ ...g, key: s.key });
  }
  const hasHadith = sources.some((s) => s.kind === 'hadith');
  const uid = `${set}:${id}`;
  return {
    uid,
    set,
    id,
    title,
    translation: {},
    refText,
    sources,
    gradingState: !hasHadith ? 'sans_objet' : missing ? 'non_verifie' : 'verifie',
    gradings,
    divergence,
    review: reviewFor(uid),
    ...extra,
  };
}

let cache: ProvenanceItem[] | null = null;
/** Tous les items de contenu religieux, avec leur provenance. */
export function allProvenance(): ProvenanceItem[] {
  if (cache) return cache;
  const items: ProvenanceItem[] = [];
  for (const d of DUAS_LIST) items.push(build('duas', d.id, d.title, d.ref, { arabic: d.ar, translit: d.tr, translation: { fr: d.fr } }));
  for (const h of HADITHS) items.push(build('hadiths', h.id, h.topic, h.ref, { arabic: h.ar, translit: h.tr, translation: { fr: h.fr } }));
  for (const s of SALAWAT) items.push(build('salawat', s.id, s.title, s.ref, { arabic: s.ar, translit: s.tr, translation: { fr: s.fr } }));
  ADILLA.forEach((a, i) => items.push(build('adilla', String(i), a.topic, a.ref, { translation: { fr: a.text } })));
  for (const [k, f] of Object.entries(FORMULAS))
    items.push(build('tijani', k, f.title, 'Tradition tijanie', { arabic: f.ar, translit: f.tr, translation: { fr: f.fr, en: f.en } }));
  items.push(build('names', 'enumeration', 'Les 99 Noms d’Allah (énumération)', NAMES_REF, { translation: { fr: 'Énumération des Noms (at-Tirmidhī 3507) ; hadith des 99 Noms (al-Bukhārī 7392, Muslim 2677).' } }));
  for (const q of QURAN_DUAS) {
    const m = /^(\d+):(\d+)(?:-(\d+))?/.exec(q.ref);
    const src = m ? [quranRef(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined)] : [];
    items.push(build('quran-duas', q.id, q.title, `Coran ${q.ref}`, { arabic: q.ar, translit: q.tr, translation: { fr: q.fr } }, src));
  }
  cache = items;
  return items;
}

export function provenanceFor(set: ProvenanceSet, id: string): ProvenanceItem | undefined {
  return allProvenance().find((x) => x.set === set && x.id === id);
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
