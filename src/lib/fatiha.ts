/**
 * Al-Fatiha (sourate 1) — texte uthmani Tanzil exact (identique à src/lib/quran-uthmani.ts, vérifié par scripts/test-fatiha.mjs).
 * Utilisée comme première étape (1×) des pratiques Tijaniyya et, si le réglage est actif (par défaut), des compositions « Mes zikrs ».
 * Le texte arabe n’est jamais modifié ; seules des marques de fin de verset (۝ + numéro) séparent les versets à l’affichage.
 */
import type { ZikrItem } from './zikr';

export const FATIHA_AYAHS: readonly string[] = [
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
  'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  'مَٰلِكِ يَوْمِ ٱلدِّينِ',
  'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
  'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
  'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arNum = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

/** Texte affiché : les 7 versets séparés par la marque de fin de verset. */
export const FATIHA_AR = FATIHA_AYAHS.map((t, i) => `${t} \u06DD${arNum(i + 1)}`).join(' ');
export const FATIHA_TR =
  'Bismi-llāhi-r-raḥmāni-r-raḥīm. Al-ḥamdu li-llāhi rabbi-l-ʿālamīn. Ar-raḥmāni-r-raḥīm. Māliki yawmi-d-dīn. Iyyāka naʿbudu wa iyyāka nastaʿīn. Ihdinā-ṣ-ṣirāṭa-l-mustaqīm. Ṣirāṭa-lladhīna anʿamta ʿalayhim, ghayri-l-maghḍūbi ʿalayhim wa lā-ḍ-ḍāllīn.';
/** Traduction du sens rédigée pour l’app — à relire. */
export const FATIHA_FR =
  'Au nom d’Allah, le Tout-Miséricordieux, le Très-Miséricordieux. Louange à Allah, Seigneur des mondes, le Tout-Miséricordieux, le Très-Miséricordieux, Souverain du Jour de la Rétribution. C’est Toi seul que nous adorons, et c’est de Toi seul que nous implorons l’aide. Guide-nous sur le chemin droit, le chemin de ceux que Tu as comblés, non de ceux qui ont encouru la colère, ni des égarés. (sens — traduction de l’app, à relire)';
/** M. Pickthall (1930), domaine public. */
export const FATIHA_EN =
  'In the name of Allah, the Beneficent, the Merciful. Praise be to Allah, Lord of the Worlds, the Beneficent, the Merciful, Owner of the Day of Judgment. Thee (alone) we worship; Thee (alone) we ask for help. Show us the straight path, the path of those whom Thou hast favoured; not (the path) of those who earn Thine anger nor of those who go astray. (Pickthall, public domain)';

export const FATIHA_ITEM_ID = 'fatiha-first';

/** Étape « Al-Fatiha » 1× pour les compositions (non enregistrée dans la composition). */
export function fatihaItem(): ZikrItem {
  return { id: FATIHA_ITEM_ID, kind: 'quran', ref: '1:1-7', label: 'Al-Fatiha', ar: FATIHA_AR, tr: FATIHA_TR, fr: FATIHA_FR, reps: 1 };
}

/** Vrai si l’élément est déjà la Fatiha complète (ajoutée par l’utilisateur ou par l’app). */
export function isFatiha(it: Pick<ZikrItem, 'id' | 'ref' | 'kind'>): boolean {
  if (it.id === FATIHA_ITEM_ID) return true;
  const r = (it.ref ?? '').replace(/\s/g, '');
  return (it.kind === 'quran' || it.kind === 'verse') && /^(?:Coran)?1(?::1-7)?$/i.test(r);
}

/**
 * Étapes de pratique : Al-Fatiha 1× en tête si `on`, sauf composition vide ou commençant déjà par la Fatiha.
 * Ne modifie pas la composition enregistrée (rien n’est supprimé ni réécrit).
 */
export function withFatiha(items: ZikrItem[], on: boolean): ZikrItem[] {
  if (!on || !items.length || isFatiha(items[0])) return items;
  return [fatihaItem(), ...items];
}
