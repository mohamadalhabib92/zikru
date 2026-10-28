/**
 * Les 99 Noms d’Allah (al-Asmā’ al-Ḥusnā) — énumération de Jāmi‘ at-Tirmidhī n° 3507 (texte de sunnah.com).
 * Le hadith « Allah a quatre-vingt-dix-neuf noms ; quiconque les dénombre entre au Paradis » est authentique
 * (al-Bukhārī 7392, Muslim 2677). L’énumération elle-même n’est rapportée que par Tirmidhī (« gharīb », jugée
 * faible par Darussalam ; beaucoup de savants y voient une insertion d’un rapporteur). Dans cette version,
 * « Allāh » ouvre la liste et forme le 99e nom ; d’autres éditions ajoutent « al-Aḥad » après « al-Wāḥid ».
 * Abjad : calculé sur le nom sans l’article « al- » (usage traditionnel : Yā Laṭīf = 129).
 */
import { normalizeArabic } from './abjad';

export type AllahName = { n: number; ar: string; tr: string; fr: string };

const RAW: [string, string, string][] = [
  ['اللَّهُ', 'Allāh', 'Allah, le Nom propre de Dieu'],
  ['الرَّحْمَنُ', 'Ar-Raḥmān', 'Le Tout-Miséricordieux'],
  ['الرَّحِيمُ', 'Ar-Raḥīm', 'Le Très-Miséricordieux'],
  ['الْمَلِكُ', 'Al-Malik', 'Le Roi, le Souverain'],
  ['الْقُدُّوسُ', 'Al-Quddūs', 'Le Pur, le Saint'],
  ['السَّلاَمُ', 'As-Salām', 'La Paix, le Préservé de tout défaut'],
  ['الْمُؤْمِنُ', 'Al-Mu’min', 'Celui qui accorde la sécurité, le Fidèle'],
  ['الْمُهَيْمِنُ', 'Al-Muhaymin', 'Le Préservateur, le Témoin vigilant'],
  ['الْعَزِيزُ', 'Al-‘Azīz', 'Le Tout-Puissant, l’Invincible'],
  ['الْجَبَّارُ', 'Al-Jabbār', 'Le Contraignant, Celui qui répare'],
  ['الْمُتَكَبِّرُ', 'Al-Mutakabbir', 'Le Suprêmement Grand'],
  ['الْخَالِقُ', 'Al-Khāliq', 'Le Créateur'],
  ['الْبَارِئُ', 'Al-Bāri’', 'Celui qui donne l’existence, le Producteur'],
  ['الْمُصَوِّرُ', 'Al-Muṣawwir', 'Celui qui donne forme'],
  ['الْغَفَّارُ', 'Al-Ghaffār', 'Celui qui pardonne sans cesse'],
  ['الْقَهَّارُ', 'Al-Qahhār', 'Le Dominateur suprême'],
  ['الْوَهَّابُ', 'Al-Wahhāb', 'Le Donateur généreux'],
  ['الرَّزَّاقُ', 'Ar-Razzāq', 'Le Pourvoyeur'],
  ['الْفَتَّاحُ', 'Al-Fattāḥ', 'Celui qui ouvre, le Juge'],
  ['الْعَلِيمُ', 'Al-‘Alīm', 'L’Omniscient'],
  ['الْقَابِضُ', 'Al-Qābiḍ', 'Celui qui restreint'],
  ['الْبَاسِطُ', 'Al-Bāsiṭ', 'Celui qui étend, qui donne largement'],
  ['الْخَافِضُ', 'Al-Khāfiḍ', 'Celui qui abaisse'],
  ['الرَّافِعُ', 'Ar-Rāfi‘', 'Celui qui élève'],
  ['الْمُعِزُّ', 'Al-Mu‘izz', 'Celui qui honore'],
  ['الْمُذِلُّ', 'Al-Mudhill', 'Celui qui humilie'],
  ['السَّمِيعُ', 'As-Samī‘', 'L’Audient'],
  ['الْبَصِيرُ', 'Al-Baṣīr', 'Le Clairvoyant'],
  ['الْحَكَمُ', 'Al-Ḥakam', 'L’Arbitre, le Juge'],
  ['الْعَدْلُ', 'Al-‘Adl', 'Le Juste'],
  ['اللَّطِيفُ', 'Al-Laṭīf', 'Le Subtil, le Bienveillant'],
  ['الْخَبِيرُ', 'Al-Khabīr', 'Le Parfaitement Informé'],
  ['الْحَلِيمُ', 'Al-Ḥalīm', 'Le Longanime'],
  ['الْعَظِيمُ', 'Al-‘Aẓīm', 'L’Immense, le Magnifique'],
  ['الْغَفُورُ', 'Al-Ghafūr', 'Le Pardonneur'],
  ['الشَّكُورُ', 'Ash-Shakūr', 'Le Reconnaissant'],
  ['الْعَلِيُّ', 'Al-‘Aliyy', 'Le Très-Haut'],
  ['الْكَبِيرُ', 'Al-Kabīr', 'Le Grand'],
  ['الْحَفِيظُ', 'Al-Ḥafīẓ', 'Le Gardien'],
  ['الْمُقِيتُ', 'Al-Muqīt', 'Celui qui nourrit et maintient'],
  ['الْحَسِيبُ', 'Al-Ḥasīb', 'Celui qui suffit, qui tient compte'],
  ['الْجَلِيلُ', 'Al-Jalīl', 'Le Majestueux'],
  ['الْكَرِيمُ', 'Al-Karīm', 'Le Généreux, le Noble'],
  ['الرَّقِيبُ', 'Ar-Raqīb', 'L’Observateur'],
  ['الْمُجِيبُ', 'Al-Mujīb', 'Celui qui exauce'],
  ['الْوَاسِعُ', 'Al-Wāsi‘', 'Le Vaste, l’Immense'],
  ['الْحَكِيمُ', 'Al-Ḥakīm', 'Le Sage'],
  ['الْوَدُودُ', 'Al-Wadūd', 'Le Bien-Aimant'],
  ['الْمَجِيدُ', 'Al-Majīd', 'Le Glorieux'],
  ['الْبَاعِثُ', 'Al-Bā‘ith', 'Celui qui ressuscite'],
  ['الشَّهِيدُ', 'Ash-Shahīd', 'Le Témoin'],
  ['الْحَقُّ', 'Al-Ḥaqq', 'La Vérité, le Vrai'],
  ['الْوَكِيلُ', 'Al-Wakīl', 'Le Garant, Celui à qui l’on s’en remet'],
  ['الْقَوِيُّ', 'Al-Qawiyy', 'Le Fort'],
  ['الْمَتِينُ', 'Al-Matīn', 'L’Inébranlable'],
  ['الْوَلِيُّ', 'Al-Waliyy', 'Le Protecteur, l’Allié'],
  ['الْحَمِيدُ', 'Al-Ḥamīd', 'Le Digne de louange'],
  ['الْمُحْصِي', 'Al-Muḥṣī', 'Celui qui dénombre tout'],
  ['الْمُبْدِئُ', 'Al-Mubdi’', 'Celui qui commence la création'],
  ['الْمُعِيدُ', 'Al-Mu‘īd', 'Celui qui la fait revenir'],
  ['الْمُحْيِي', 'Al-Muḥyī', 'Celui qui donne la vie'],
  ['الْمُمِيتُ', 'Al-Mumīt', 'Celui qui donne la mort'],
  ['الْحَيُّ', 'Al-Ḥayy', 'Le Vivant'],
  ['الْقَيُّومُ', 'Al-Qayyūm', 'Celui qui subsiste par Lui-même et fait tout subsister'],
  ['الْوَاجِدُ', 'Al-Wājid', 'Celui qui trouve tout, l’Opulent'],
  ['الْمَاجِدُ', 'Al-Mājid', 'L’Illustre'],
  ['الْوَاحِدُ', 'Al-Wāḥid', 'L’Unique'],
  ['الصَّمَدُ', 'Aṣ-Ṣamad', 'L’Absolu, Celui dont tout dépend'],
  ['الْقَادِرُ', 'Al-Qādir', 'Le Capable'],
  ['الْمُقْتَدِرُ', 'Al-Muqtadir', 'Le Tout-Puissant'],
  ['الْمُقَدِّمُ', 'Al-Muqaddim', 'Celui qui fait avancer'],
  ['الْمُؤَخِّرُ', 'Al-Mu’akhkhir', 'Celui qui fait reculer'],
  ['الأَوَّلُ', 'Al-Awwal', 'Le Premier'],
  ['الآخِرُ', 'Al-Ākhir', 'Le Dernier'],
  ['الظَّاهِرُ', 'Aẓ-Ẓāhir', 'L’Apparent'],
  ['الْبَاطِنُ', 'Al-Bāṭin', 'Le Caché'],
  ['الْوَالِي', 'Al-Wālī', 'Le Maître, le Gouverneur'],
  ['الْمُتَعَالِي', 'Al-Muta‘ālī', 'Le Sublime'],
  ['الْبَرُّ', 'Al-Barr', 'Le Bienfaisant'],
  ['التَّوَّابُ', 'At-Tawwāb', 'Celui qui accueille le repentir'],
  ['الْمُنْتَقِمُ', 'Al-Muntaqim', 'Celui qui châtie'],
  ['الْعَفُوُّ', 'Al-‘Afuww', 'Celui qui efface les fautes'],
  ['الرَّءُوفُ', 'Ar-Ra’ūf', 'Le Très-Doux, le Compatissant'],
  ['مَالِكُ الْمُلْكِ', 'Mālik al-Mulk', 'Le Possesseur de la royauté'],
  ['ذُو الْجَلاَلِ وَالإِكْرَامِ', 'Dhū-l-Jalāli wa-l-Ikrām', 'Le Détenteur de la majesté et de la générosité'],
  ['الْمُقْسِطُ', 'Al-Muqsiṭ', 'L’Équitable'],
  ['الْجَامِعُ', 'Al-Jāmi‘', 'Celui qui rassemble'],
  ['الْغَنِيُّ', 'Al-Ghaniyy', 'Le Riche, Celui qui se suffit à Lui-même'],
  ['الْمُغْنِي', 'Al-Mughnī', 'Celui qui enrichit'],
  ['الْمَانِعُ', 'Al-Māni‘', 'Celui qui retient, qui protège'],
  ['الضَّارُّ', 'Aḍ-Ḍārr', 'Celui qui peut nuire (par Sa sagesse)'],
  ['النَّافِعُ', 'An-Nāfi‘', 'Celui qui accorde le bienfait'],
  ['النُّورُ', 'An-Nūr', 'La Lumière'],
  ['الْهَادِي', 'Al-Hādī', 'Le Guide'],
  ['الْبَدِيعُ', 'Al-Badī‘', 'L’Inventeur sans modèle'],
  ['الْبَاقِي', 'Al-Bāqī', 'L’Éternel, Celui qui demeure'],
  ['الْوَارِثُ', 'Al-Wārith', 'L’Héritier de toute chose'],
  ['الرَّشِيدُ', 'Ar-Rashīd', 'Le Guide vers la droiture'],
  ['الصَّبُورُ', 'Aṣ-Ṣabūr', 'Le Patient'],
];

export const NAMES: AllahName[] = RAW.map(([ar, tr, fr], i) => ({ n: i + 1, ar, tr, fr }));
export const NAMES_REF = 'Énumération : at-Tirmidhī 3507 (gharīb, isnad jugé faible) · « Allah a 99 noms » : al-Bukhārī 7392, Muslim 2677';

/** Nom sans l’article (pour l’abjad et l’invocation « Yā … »). « Allāh », Mālik al-Mulk et Dhū-l-Jalāl restent entiers. */
export function nameBare(ar: string): string {
  if (ar.includes(' ') || normalizeArabic(ar) === 'الله') return ar;
  // retire l’article et la chadda solaire de la 1re lettre (اللَّطِيفُ → لَطِيفُ)
  return ar.replace(/^ال[\u064B-\u0652]*(.)([\u064B-\u0652]*)/, (_m, c: string, d: string) => c + d.replace('\u0651', ''));
}
/** Forme d’invocation : « يَا لَطِيفُ », « يَا اللَّهُ ». */
export function nameCall(ar: string): string {
  return 'يَا ' + nameBare(ar);
}
/** Translittération d’invocation : « Yā Laṭīf ». */
export function nameCallTr(tr: string): string {
  if (tr === 'Allāh' || tr.startsWith('Mālik') || tr.startsWith('Dhū')) return 'Yā ' + tr;
  return 'Yā ' + tr.replace(/^(Al|Ar|As|Ash|Aṣ|Aḍ|Aẓ|At|An)-/, '');
}
