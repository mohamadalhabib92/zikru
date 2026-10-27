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
  translations: Partial<Record<'fr' | 'en' | 'de' | 'ff' | 'wo', string>>; // seulement des traductions approuvées
  source: string;
  defaultCount?: number;
  status: ContentStatus;
  seedExample?: boolean;
  updatedAt: string;
};

const now = '2026-10-27T00:00:00.000Z';
export const SEED_CONTENT: ContentItem[] = [
  { id: 'subhanallah', kind: 'dhikr', arabic: 'سُبْحَانَ ٱللَّٰهِ', transliteration: 'Subḥāna-llāh', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 597 (tasbīḥ après la prière, 33 fois)', defaultCount: 33, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'alhamdulillah', kind: 'dhikr', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', transliteration: 'Al-ḥamdu li-llāh', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 597 (taḥmīd après la prière, 33 fois)', defaultCount: 33, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'allahuakbar', kind: 'dhikr', arabic: 'ٱللَّٰهُ أَكْبَرُ', transliteration: 'Allāhu akbar', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 597 (takbīr après la prière, 33 fois)', defaultCount: 33, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'tahlil', kind: 'dhikr', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', transliteration: 'Lā ilāha illa-llāh', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 597 (complément de la centaine)', defaultCount: 1, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'istighfar', kind: 'dhikr', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', transliteration: 'Astaghfiru-llāh', translations: {}, source: 'Ṣaḥīḥ Muslim, n° 591 (3 fois après la prière)', defaultCount: 3, status: 'approved', seedExample: true, updatedAt: now },
  { id: 'hasbuna', kind: 'dua', arabic: 'حَسْبُنَا ٱللَّٰهُ وَنِعْمَ ٱلْوَكِيلُ', transliteration: 'Ḥasbuna-llāhu wa niʿma-l-wakīl', translations: {}, source: 'Coran, sourate Āl ʿImrān (3), verset 173', status: 'in_review', seedExample: true, updatedAt: now },
];

export const approvedOnly = (items: ContentItem[]) => items.filter((i) => i.status === 'approved');
export const NEXT_STATUS: Record<ContentStatus, ContentStatus | null> = { draft: 'in_review', in_review: 'approved', approved: null };
export const STATUS_LABEL: Record<ContentStatus, string> = { draft: 'Brouillon', in_review: 'En relecture', approved: 'Approuvé' };
