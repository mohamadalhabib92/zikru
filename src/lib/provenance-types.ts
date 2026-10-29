/**
 * Schéma de provenance commun à tous les textes religieux de l’app (du‘as, hadiths, salawat, adhkar, noms, preuves).
 * Règle : un jugement (grading) n’est affiché que s’il a été recopié depuis une source vérifiable
 * (sunnah.com, dorar.net) — sinon l’item est marqué « grading non vérifié ». Rien n’est deviné.
 */

/** Classe de jugement normalisée (le libellé exact du savant est conservé dans `raw`). */
export type GradeClass =
  | 'sahih'
  | 'hasan_sahih'
  | 'hasan'
  | 'hasan_li_ghayrihi'
  | 'sahih_isnad'
  | 'hasan_isnad'
  | 'daif_isnad'
  | 'daif'
  | 'mawdu'
  | 'autre';

export type VerifiedGrading = {
  grade: GradeClass;
  /** Savant ou recueil auteur du jugement (al-Albānī, Shu‘ayb al-Arna’ūṭ, …). */
  grader: string;
  /** Libellé tel qu’affiché par le site. */
  raw: string;
  site: 'sunnah.com' | 'dorar.net';
  url: string;
  book?: string;
  also?: string[];
};

export type HadithCheck = {
  key: string;
  label: string;
  url: string;
  found: boolean;
  gradings: VerifiedGrading[];
  /** Vrai si les jugements vérifiés divergent (ex. ṣaḥīḥ chez l’un, ḍa‘īf chez l’autre). */
  divergence: boolean;
};

export type SourceRef = {
  kind: 'hadith' | 'coran' | 'tariqa' | 'usage' | 'fiqh';
  label: string;
  collection?: string;
  number?: number;
  surah?: number;
  ayah?: number;
  ayahEnd?: number;
  /** Clé de vérification, ex. 'bukhari:6324'. */
  key?: string;
  url?: string;
};

export type ReviewStatus = 'a_valider' | 'valide' | 'a_corriger';
export type Review = {
  status: ReviewStatus;
  /** Rôle du validateur (ex. « muhaddith », « faqih malikite ») — jamais un nom sans son accord. */
  role?: string;
  date?: string;
  /** Version de l’app / du contenu validée. */
  version?: string;
  note?: string;
};

export type ProvenanceSet = 'duas' | 'hadiths' | 'salawat' | 'adilla' | 'names' | 'quran-duas' | 'tijani';

export type ProvenanceItem = {
  /** Identifiant global stable : `${set}:${id}`. */
  uid: string;
  set: ProvenanceSet;
  id: string;
  title: string;
  arabic?: string;
  translit?: string;
  translation: { fr?: string; en?: string; ar?: string };
  /** Référence telle qu’affichée dans l’app. */
  refText: string;
  sources: SourceRef[];
  /** verifie : ≥ 1 jugement recopié pour chaque hadith cité ; non_verifie : au moins un hadith sans jugement ; sans_objet : Coran / tradition / usage. */
  gradingState: 'verifie' | 'non_verifie' | 'sans_objet';
  gradings: (VerifiedGrading & { key: string })[];
  divergence: boolean;
  review: Review;
};
