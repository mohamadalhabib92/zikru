import { DUA_YUNUS_AR, HASBUNALLAH_AR, SALAT_FATIHA_AR } from './tasbih-preset-ar';

/**
 * WORKFLOW DE CONTENU : draft → in_review → approved.
 * L'interface utilisateur n'affiche QUE les éléments « approved » (filtre unique `approvedOnly`).
 * Chaque élément cite sa source. Les traductions n'existent que si elles ont été approuvées :
 * aucune traduction religieuse n'est générée ni inventée par l'app.
 *
 * Contenu d'amorçage (seed) : formules arabes courantes avec tashkīl, marquées « EXEMPLE —
 * à valider par un référent » ; Mohamed doit confirmer ou remplacer avant publication.
 */
export type ContentStatus = 'draft' | 'in_review' | 'approved';
export type ContentItem = {
  id: string;
  kind: 'dhikr' | 'dua';
  arabic: string; // texte sacré : diacritiques conservés
  transliteration?: string;
  translations: Partial<Record<'fr' | 'en' | 'de' | 'ar' | 'ff' | 'wo', string>>; // seulement des traductions approuvées
  source: string;
  defaultCount?: number;
  /** Cibles rapides. Le compte ne s’arrête pas à la cible : on peut en choisir une plus haute. */
  targets?: number[];
  status: ContentStatus;
  seedExample?: boolean;
  updatedAt: string;
};

const now = '2026-10-27T00:00:00.000Z';
const presetAt = '2026-11-14T00:00:00.000Z';

/**
 * Trois formules ajoutées au compteur. Gratuites. Elles sont ajoutées aux données
 * déjà enregistrées seulement si leur identifiant n’existe pas : rien n’est écrasé.
 */
export const TASBIH_PRESETS: ContentItem[] = [
  {
    id: 'salat-fatih',
    kind: 'dhikr',
    arabic: SALAT_FATIHA_AR,
    transliteration: 'Allâhumma salli ‘alâ sayyidinâ Muhammadin al-fâtihi limâ ughliq, wal-khâtimi limâ sabaq, nâsiri l-haqqi bil-haqq, wal-hâdî ilâ sirâtika l-mustaqîm, wa ‘alâ âlihi haqqa qadrihi wa miqdârihi l-‘azîm.',
    translations: {
      fr: 'Ô Allah, prie sur notre seigneur Muhammad, celui qui ouvre ce qui était clos, qui scelle ce qui a précédé, qui secourt la vérité par la vérité, qui guide vers Ton chemin droit, et sur sa famille, selon son immense rang.',
      en: 'O Allah, bless our master Muhammad, the opener of what was closed, the seal of what came before, the supporter of the truth by the truth, the guide to Your straight path, and his family, according to his immense rank.',
      de: 'O Allah, segne unseren Herrn Muhammad, der öffnet, was verschlossen war, der besiegelt, was zuvor war, der die Wahrheit durch die Wahrheit stärkt, der zu Deinem geraden Weg führt, und seine Familie, nach seinem gewaltigen Rang.',
      ar: 'صلاة على سيدنا محمد ﷺ، الفاتح لما أُغلق والخاتم لما سبق، وعلى آله بقدر مقامه العظيم.',
    },
    source: 'Ṣalāt al-Fātiḥ, wird tijānī (Jawāhir al-maʿānī) — sans « wa ṣaḥbihi »',
    defaultCount: 100,
    targets: [100, 200, 300, 500, 1000],
    status: 'approved',
    updatedAt: presetAt,
  },
  {
    id: 'hasbunallah',
    kind: 'dhikr',
    arabic: HASBUNALLAH_AR,
    transliteration: 'Ḥasbunallāhu wa niʿma l-wakīl',
    translations: {
      fr: 'Allah nous suffit. Il est le meilleur garant.',
      en: 'Allah is sufficient for us, and He is the best disposer of affairs.',
      de: 'Allah genügt uns, und Er ist der beste Sachwalter.',
      ar: 'الله يكفينا، وهو خير من يُوكَل إليه الأمر.',
    },
    source: 'Coran, Āl ʿImrān 3:173 — Tanzil uthmani (CC BY 3.0), formule citée dans le verset',
    defaultCount: 70,
    targets: [70, 100, 200, 300],
    status: 'approved',
    updatedAt: presetAt,
  },
  {
    id: 'dua-yunus',
    kind: 'dua',
    arabic: DUA_YUNUS_AR,
    transliteration: 'Lâ ilâha illâ anta subhânaka innî kuntu mina z-zâlimîn.',
    translations: {
      fr: 'Pas de dieu en dehors de Toi. Gloire à Toi. J’étais parmi les injustes.',
      en: 'There is no god but You. Glory be to You. I was among the wrongdoers.',
      de: 'Es gibt keinen Gott außer Dir. Gepriesen seist Du. Ich gehörte zu denen, die Unrecht taten.',
      ar: 'لا إله إلا أنت، سبحانك، إني كنت من الظالمين.',
    },
    source: 'Coran, Al-Anbiyāʾ 21:87 — Tanzil uthmani (CC BY 3.0), parole de Yûnus',
    defaultCount: 41,
    targets: [41, 100, 200],
    status: 'approved',
    updatedAt: presetAt,
  },
];

/** Ajoute les présets absents. Ne modifie aucune fiche déjà enregistrée. */
export function mergePresets(items: ContentItem[]): ContentItem[] {
  if (!Array.isArray(items)) return TASBIH_PRESETS.map((p) => ({ ...p, translations: { ...p.translations }, targets: p.targets ? [...p.targets] : undefined }));
  const ids = new Set(items.map((i) => i.id));
  const missing = TASBIH_PRESETS.filter((p) => !ids.has(p.id));
  if (!missing.length) return items;
  return [...items, ...missing.map((p) => ({ ...p, translations: { ...p.translations }, targets: p.targets ? [...p.targets] : undefined }))];
}

export const SEED_CONTENT: ContentItem[] = [
  { id: 'subhanallah', kind: 'dhikr', arabic: 'سُبْحَانَ ٱللَّٰهِ', transliteration: 'Subḥāna-llāh', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 597 (tasbīḥ après la prière, 33 fois)', defaultCount: 33, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'alhamdulillah', kind: 'dhikr', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', transliteration: 'Al-ḥamdu li-llāh', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 597 (taḥmīd après la prière, 33 fois)', defaultCount: 33, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'allahuakbar', kind: 'dhikr', arabic: 'ٱللَّٰهُ أَكْبَرُ', transliteration: 'Allāhu akbar', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 597 (takbīr après la prière, 33 fois)', defaultCount: 33, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'tahlil', kind: 'dhikr', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', transliteration: 'Lā ilāha illa-llāh', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 597 (complément de la centaine)', defaultCount: 1, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'istighfar', kind: 'dhikr', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', transliteration: 'Astaghfiru-llāh', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 591 (3 fois après la prière)', defaultCount: 3, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'hasbuna', kind: 'dua', arabic: 'حَسْبُنَا ٱللَّٰهُ وَنِعْمَ ٱلْوَكِيلُ', transliteration: 'Ḥasbuna-llāhu wa niʿma-l-wakīl', translations: {}, source: 'Coran, sourate Āl ʿImrān (3), verset 173', status: 'in_review', seedExample: true, updatedAt: now },
  ...TASBIH_PRESETS,
];

export const approvedOnly = (items: ContentItem[]) => items.filter((i) => i.status === 'approved');
export const NEXT_STATUS: Record<ContentStatus, ContentStatus | null> = { draft: 'in_review', in_review: 'approved', approved: null };
export const STATUS_LABEL: Record<ContentStatus, string> = { draft: 'Brouillon', in_review: 'En relecture', approved: 'Approuvé' };
