/**
 * Prières sur le Prophète ﷺ. Formules prophétiques : texte de sunnah.com.
 * Formules usuelles : courtes, en application de l’ordre coranique (al-Aḥzāb 33:56) — aucune attribution à un hadith précis.
 * Formules tijanies : textes déjà présents dans l’app (lib/tijani.ts), issus de la tradition de la Ṭarīqa, non d’un hadith.
 */
import { FORMULAS } from './tijani';

export type Salat = {
  id: string;
  title: string;
  ar: string;
  tr: string;
  fr: string;
  ref: string;
  kind: 'prophetique' | 'usuelle' | 'tijani';
};

export const SALAWAT: Salat[] = [
  {
    id: 'ibrahimiyya',
    kind: 'prophetique',
    title: 'Ṣalāt Ibrāhīmiyya',
    ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ، وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ، وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ، وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    tr: 'Allāhumma ṣalli ʿalā Muḥammad wa ʿalā āli Muḥammad, kamā ṣallayta ʿalā Ibrāhīma wa ʿalā āli Ibrāhīm, innaka Ḥamīdun Majīd. Allāhumma bārik ʿalā Muḥammad wa ʿalā āli Muḥammad, kamā bārakta ʿalā Ibrāhīma wa ʿalā āli Ibrāhīm, innaka Ḥamīdun Majīd',
    fr: 'Ô Allah, prie sur Muhammad et sur la famille de Muhammad, comme Tu as prié sur Ibrāhīm et sur la famille d’Ibrāhīm ; Tu es certes Digne de louange et Glorieux. Ô Allah, bénis Muhammad et la famille de Muhammad, comme Tu as béni Ibrāhīm et la famille d’Ibrāhīm ; Tu es certes Digne de louange et Glorieux.',
    ref: 'al-Bukhārī 3370 (Ka‘b ibn ‘Ujra)',
  },
  {
    id: 'ibrahimiyya-muslim',
    kind: 'prophetique',
    title: 'Ṣalāt Ibrāhīmiyya (« fī-l-‘ālamīn »)',
    ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى آلِ إِبْرَاهِيمَ وَبَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَى آلِ إِبْرَاهِيمَ فِي الْعَالَمِينَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
    tr: 'Allāhumma ṣalli ʿalā Muḥammad wa ʿalā āli Muḥammad kamā ṣallayta ʿalā āli Ibrāhīm, wa bārik ʿalā Muḥammad wa ʿalā āli Muḥammad kamā bārakta ʿalā āli Ibrāhīm, fī-l-ʿālamīn, innaka Ḥamīdun Majīd',
    fr: 'Ô Allah, prie sur Muhammad et sur la famille de Muhammad comme Tu as prié sur la famille d’Ibrāhīm, et bénis Muhammad et la famille de Muhammad comme Tu as béni la famille d’Ibrāhīm, dans les mondes ; Tu es certes Digne de louange et Glorieux.',
    ref: 'Muslim 405 (Abū Mas‘ūd al-Anṣārī)',
  },
  {
    id: 'azwaj',
    kind: 'prophetique',
    title: 'Sur ses épouses et sa descendance',
    ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَأَزْوَاجِهِ وَذُرِّيَّتِهِ، كَمَا صَلَّيْتَ عَلَى آلِ إِبْرَاهِيمَ، وَبَارِكْ عَلَى مُحَمَّدٍ وَأَزْوَاجِهِ وَذُرِّيَّتِهِ، كَمَا بَارَكْتَ عَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    tr: 'Allāhumma ṣalli ʿalā Muḥammadin wa azwājihi wa dhurriyyatih, kamā ṣallayta ʿalā āli Ibrāhīm, wa bārik ʿalā Muḥammadin wa azwājihi wa dhurriyyatih, kamā bārakta ʿalā āli Ibrāhīm, innaka Ḥamīdun Majīd',
    fr: 'Ô Allah, prie sur Muhammad, ses épouses et sa descendance, comme Tu as prié sur la famille d’Ibrāhīm, et bénis Muhammad, ses épouses et sa descendance, comme Tu as béni la famille d’Ibrāhīm ; Tu es certes Digne de louange et Glorieux.',
    ref: 'al-Bukhārī 3369 (Abū Ḥumayd as-Sā‘idī)',
  },
  {
    id: 'abdika',
    kind: 'prophetique',
    title: 'Sur Muhammad, Ton serviteur et Messager',
    ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ عَبْدِكَ وَرَسُولِكَ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ، وَبَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَآلِ إِبْرَاهِيمَ',
    tr: 'Allāhumma ṣalli ʿalā Muḥammadin ʿabdika wa rasūlik, kamā ṣallayta ʿalā Ibrāhīm, wa bārik ʿalā Muḥammadin wa ʿalā āli Muḥammad, kamā bārakta ʿalā Ibrāhīma wa āli Ibrāhīm',
    fr: 'Ô Allah, prie sur Muhammad, Ton serviteur et Ton Messager, comme Tu as prié sur Ibrāhīm, et bénis Muhammad et la famille de Muhammad comme Tu as béni Ibrāhīm et la famille d’Ibrāhīm.',
    ref: 'al-Bukhārī 6358 (Abū Sa‘īd al-Khudrī)',
  },
  {
    id: 'sallallah',
    kind: 'usuelle',
    title: 'Formule courte',
    ar: 'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ',
    tr: 'Ṣalla-llāhu ʿalayhi wa sallam',
    fr: 'Qu’Allah prie sur lui et le salue.',
    ref: 'Formule usuelle — cf. Coran 33:56 ; « Qui prie sur moi une fois, Allah prie sur lui dix fois » (Muslim 408)',
  },
  {
    id: 'salli-sallim',
    kind: 'usuelle',
    title: 'Prière et salut sur notre Prophète',
    ar: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ',
    tr: 'Allāhumma ṣalli wa sallim ʿalā nabiyyinā Muḥammad',
    fr: 'Ô Allah, prie sur notre Prophète Muhammad et salue-le.',
    ref: 'Formule usuelle — cf. Coran 33:56 (« priez sur lui et saluez-le »)',
  },
  {
    id: 'salli-ala-muhammad',
    kind: 'usuelle',
    title: 'Ô Allah, prie sur Muhammad',
    ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ',
    tr: 'Allāhumma ṣalli ʿalā Muḥammad wa ʿalā āli Muḥammad',
    fr: 'Ô Allah, prie sur Muhammad et sur la famille de Muhammad.',
    ref: 'Début de la Ṣalāt Ibrāhīmiyya (al-Bukhārī 3370) — forme abrégée usuelle',
  },
  ...(['fatih', 'jawhara'] as const).map((k) => {
    const f = FORMULAS[k];
    return {
      id: 'tijani-' + k,
      kind: 'tijani' as const,
      title: f.title,
      ar: f.ar,
      tr: f.tr,
      fr: f.fr,
      ref: k === 'fatih' ? 'Tradition tijanie (wird, wazifa) — formule transmise dans la Ṭarīqa, non issue d’un hadith' : 'Tradition tijanie (wazifa) — formule transmise dans la Ṭarīqa, non issue d’un hadith',
    };
  }),
];
