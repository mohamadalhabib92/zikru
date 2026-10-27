/**
 * Contenu de la voie Tijaniyya (Tariqa Tijaniyya).
 * Règles : textes arabes couramment diffusés dans la tariqa ; traductions françaises / anglaises
 * indicatives, rédigées pour l'app (marquées comme telles). Références vérifiables uniquement
 * (sourate:verset, recueil + numéro de hadith). En cas de divergence, l'enseignement du muqaddam prime.
 */

export type Formula = { id: string; title: string; ar: string; tr: string; fr: string; en: string; note?: string; indicative?: boolean };

export const FORMULAS: Record<string, Formula> = {
  istighfar: {
    id: 'istighfar',
    title: 'Istighfar (wird)',
    ar: 'أَسْتَغْفِرُ اللَّهَ',
    tr: 'Astaghfiru-llāh',
    fr: 'Je demande pardon à Allah.',
    en: 'I seek forgiveness from Allah.',
  },
  istighfarWazifa: {
    id: 'istighfarWazifa',
    title: 'Istighfar (wazifa)',
    ar: 'أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ',
    tr: 'Astaghfiru-llāha-l-ʿaẓīma-lladhī lā ilāha illā huwa-l-ḥayya-l-qayyūm',
    fr: 'Je demande pardon à Allah, l’Immense, en dehors de qui il n’y a pas de divinité, le Vivant, Celui qui subsiste par Lui-même.',
    en: 'I seek forgiveness from Allah the Magnificent, besides whom there is no god, the Ever-Living, the Self-Subsisting.',
  },
  fatih: {
    id: 'fatih',
    title: 'Salat al-Fatih',
    ar: 'اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ الْفَاتِحِ لِمَا أُغْلِقَ، وَالْخَاتِمِ لِمَا سَبَقَ، نَاصِرِ الْحَقِّ بِالْحَقِّ، وَالْهَادِي إِلَى صِرَاطِكَ الْمُسْتَقِيمِ، وَعَلَى آلِهِ حَقَّ قَدْرِهِ وَمِقْدَارِهِ الْعَظِيمِ',
    tr: 'Allāhumma ṣalli ʿalā sayyidinā Muḥammadini-l-fātiḥi limā ughliq, wa-l-khātimi limā sabaq, nāṣiri-l-ḥaqqi bi-l-ḥaqq, wa-l-hādī ilā ṣirāṭika-l-mustaqīm, wa ʿalā ālihi ḥaqqa qadrihi wa miqdārihi-l-ʿaẓīm',
    fr: 'Ô Allah, prie sur notre maître Muhammad, celui qui a ouvert ce qui était fermé, le sceau de ce qui a précédé, celui qui fait triompher la vérité par la vérité, le guide vers Ta voie droite, ainsi que sur sa famille, selon la juste mesure de son rang immense.',
    en: 'O Allah, send blessings upon our master Muhammad, the opener of what was closed, the seal of what preceded, the helper of truth by truth, the guide to Your straight path, and upon his family, according to the true measure of his immense rank.',
    indicative: true,
  },
  hailala: {
    id: 'hailala',
    title: 'Hailala',
    ar: 'لَا إِلَهَ إِلَّا اللَّهُ',
    tr: 'Lā ilāha illā-llāh',
    fr: 'Il n’y a de divinité qu’Allah.',
    en: 'There is no god but Allah.',
  },
  closing: {
    id: 'closing',
    title: 'Clôture de la Hailala (wird)',
    ar: 'سَيِّدُنَا مُحَمَّدٌ رَسُولُ اللَّهِ عَلَيْهِ سَلَامُ اللَّهِ',
    tr: 'Sayyidunā Muḥammadun rasūlu-llāh, ʿalayhi salāmu-llāh',
    fr: 'Notre maître Muhammad est le Messager d’Allah, que la paix d’Allah soit sur lui.',
    en: 'Our master Muhammad is the Messenger of Allah, upon him be the peace of Allah.',
  },
  jawhara: {
    id: 'jawhara',
    title: 'Jawharat al-Kamal',
    ar: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى عَيْنِ الرَّحْمَةِ الرَّبَّانِيَّةِ، وَالْيَاقُوتَةِ الْمُتَحَقِّقَةِ الْحَائِطَةِ بِمَرْكَزِ الْفُهُومِ وَالْمَعَانِي، وَنُورِ الْأَكْوَانِ الْمُتَكَوِّنَةِ الْآدَمِيِّ صَاحِبِ الْحَقِّ الرَّبَّانِي، الْبَرْقِ الْأَسْطَعِ بِمُزُونِ الْأَرْبَاحِ الْمَالِئَةِ لِكُلِّ مُتَعَرِّضٍ مِنَ الْبُحُورِ وَالْأَوَانِي، وَنُورِكَ اللَّامِعِ الَّذِي مَلَأْتَ بِهِ كَوْنَكَ الْحَائِطَ بِأَمْكِنَةِ الْمَكَانِي، اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى عَيْنِ الْحَقِّ الَّتِي تَتَجَلَّى مِنْهَا عُرُوشُ الْحَقَائِقِ، عَيْنِ الْمَعَارِفِ الْأَقْوَمِ، صِرَاطِكَ التَّامِّ الْأَسْقَمِ، اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى طَلْعَةِ الْحَقِّ بِالْحَقِّ، الْكَنْزِ الْأَعْظَمِ، إِفَاضَتِكَ مِنْكَ إِلَيْكَ، إِحَاطَةِ النُّورِ الْمُطَلْسَمِ، صَلَّى اللَّهُ عَلَيْهِ وَعَلَى آلِهِ صَلَاةً تُعَرِّفُنَا بِهَا إِيَّاهُ',
    tr: 'Allāhumma ṣalli wa sallim ʿalā ʿayni-r-raḥmati-r-rabbāniyya, wa-l-yāqūtati-l-mutaḥaqqiqati-l-ḥāʾiṭati bi-markazi-l-fuhūmi wa-l-maʿānī, wa nūri-l-akwāni-l-mutakawwinati-l-ādamiyyi ṣāḥibi-l-ḥaqqi-r-rabbānī, al-barqi-l-asṭaʿi bi-muzūni-l-arbāḥi-l-māliʾati li-kulli mutaʿarriḍin mina-l-buḥūri wa-l-awānī, wa nūrika-l-lāmiʿi-lladhī malaʾta bihi kawnaka-l-ḥāʾiṭa bi-amkinati-l-makānī. Allāhumma ṣalli wa sallim ʿalā ʿayni-l-ḥaqqi-llatī tatajallā minhā ʿurūshu-l-ḥaqāʾiq, ʿayni-l-maʿārifi-l-aqwam, ṣirāṭika-t-tāmmi-l-asqam. Allāhumma ṣalli wa sallim ʿalā ṭalʿati-l-ḥaqqi bi-l-ḥaqq, al-kanzi-l-aʿẓam, ifāḍatika minka ilayk, iḥāṭati-n-nūri-l-muṭalsam, ṣalla-llāhu ʿalayhi wa ʿalā ālihi ṣalātan tuʿarrifunā bihā iyyāh',
    fr: 'Ô Allah, prie et salue la source de la miséricorde divine, le rubis réalisé qui englobe le centre des compréhensions et des sens, la lumière des univers créés, l’Adamique détenteur de la vérité divine, l’éclair le plus brillant chargé des nuées de bienfaits qui emplissent toute mer et tout récipient qui s’y expose, et Ta lumière éclatante dont Tu as empli Ton univers… (traduction indicative et abrégée).',
    en: 'O Allah, send blessings and peace upon the source of divine mercy, the realised ruby encompassing the centre of understandings and meanings, the light of the created worlds, the Adamic one, possessor of the divine truth… (indicative, abridged translation).',
    note: 'Se récite en état de pureté rituelle par l’eau (wudu). En cas de tayammum, elle est remplacée par 20 Salat al-Fatih, selon ce qui est couramment enseigné.',
    indicative: true,
  },
};

export type Step = { formula: keyof typeof FORMULAS; count: number; extra?: string };

export const WIRD: { title: string; when: string; steps: Step[] } = {
  title: 'Wird (lazim)',
  when: 'Deux fois par jour : le matin (après la prière de l’aube) et le soir (après la prière de ‘Asr), selon ce qui est couramment décrit.',
  steps: [
    { formula: 'istighfar', count: 100 },
    { formula: 'fatih', count: 100 },
    { formula: 'hailala', count: 100, extra: 'La centième est suivie de la formule de clôture.' },
    { formula: 'closing', count: 1 },
  ],
};

export const WAZIFA: { title: string; when: string; steps: Step[] } = {
  title: 'Wazifa',
  when: 'Une fois par jour au minimum (matin ou soir), de préférence en groupe, selon ce qui est couramment décrit.',
  steps: [
    { formula: 'istighfarWazifa', count: 30 },
    { formula: 'fatih', count: 50 },
    { formula: 'hailala', count: 100 },
    { formula: 'jawhara', count: 12 },
  ],
};

export const HAILALA_FRIDAY = {
  title: 'Hailala du vendredi',
  when: 'Le vendredi, après la prière de ‘Asr jusqu’au coucher du soleil (Maghrib), tel que couramment décrit.',
  text: 'Répétition de « Lā ilāha illā-llāh » (ou du nom « Allāh », selon l’enseignement reçu), de préférence en groupe, sans compter précisément, jusqu’au Maghrib. Une durée minimale est souvent mentionnée ; votre muqaddam vous indiquera la pratique exacte.',
};

export type BioSection = { title: string; body: string };
export const BIOGRAPHY: BioSection[] = [
  {
    title: 'Naissance et formation',
    body: 'Abu al-‘Abbas Ahmad ibn Muhammad al-Tijani est né en 1150 H (1737) à ‘Aïn Madhi, dans le sud de l’Algérie actuelle. Il étudie très tôt le Coran et les sciences religieuses, notamment le fiqh malikite.',
  },
  {
    title: 'Voyages',
    body: 'Il voyage pour étudier et rencontrer des maîtres : Fès, Tlemcen, Tunis, Le Caire, puis La Mecque et Médine lors du pèlerinage.',
  },
  {
    title: 'Fondation de la voie',
    body: 'Selon les sources de la tariqa, la voie lui est autorisée vers 1196 H (1781-1782) à Abu Samghun (sud algérien), où il réside avant de s’établir à Fès.',
  },
  {
    title: 'Fès',
    body: 'Il s’installe à Fès en 1213 H (1798) ; sa zawiya y devient le centre de la voie. Il y meurt en 1230 H (1815) et y est enterré.',
  },
  {
    title: 'Œuvre de référence',
    body: 'Jawahir al-Ma‘ani, compilé par son disciple ‘Ali Harazim Berrada, rassemble ses enseignements et sa biographie.',
  },
  {
    title: 'Diffusion en Afrique de l’Ouest',
    body: 'La voie se répand largement en Afrique de l’Ouest, notamment par El Hadj ‘Umar Tall, El Hadji Malick Sy et Cheikh Ibrahim Niasse.',
  },
];

export const CONDITIONS: string[] = [
  'Recevoir l’autorisation (idhn) d’un muqaddam habilité.',
  'Accomplir les cinq prières, si possible en groupe et à l’heure.',
  'Respecter et honorer ses parents.',
  'Ne pas prendre un autre wird de tariqa en plus de celui-ci.',
  'Respecter tous les saints (awliya) et ne médire d’aucun.',
  'S’engager à garder le wird toute sa vie.',
  'Être en état de pureté rituelle pour les récitations.',
];

export type Evidence = { ref: string; text: string; kind: 'coran' | 'hadith'; topic: string };
export const ADILLA: Evidence[] = [
  { kind: 'coran', ref: 'Coran 33:41-42', topic: 'Dhikr abondant', text: '« Ô vous qui croyez ! Invoquez Allah d’une invocation abondante, et glorifiez-Le matin et soir. » (sens)' },
  { kind: 'coran', ref: 'Coran 33:56', topic: 'Prière sur le Prophète ﷺ', text: '« Allah et Ses anges prient sur le Prophète. Ô vous qui croyez, priez sur lui et adressez-lui vos salutations. » (sens)' },
  { kind: 'coran', ref: 'Coran 2:152', topic: 'Dhikr', text: '« Souvenez-vous de Moi, Je Me souviendrai de vous. » (sens)' },
  { kind: 'coran', ref: 'Coran 13:28', topic: 'Dhikr', text: '« N’est-ce point par l’évocation d’Allah que les cœurs se tranquillisent ? » (sens)' },
  { kind: 'coran', ref: 'Coran 71:10-12', topic: 'Istighfar', text: '« Implorez le pardon de votre Seigneur, car Il est grand Pardonneur… » (sens)' },
  { kind: 'coran', ref: 'Coran 47:19', topic: 'Tahlil et istighfar', text: '« Sache qu’il n’y a de divinité qu’Allah, et implore le pardon pour ton péché… » (sens)' },
  { kind: 'coran', ref: 'Coran 62:10', topic: 'Dhikr', text: '« … et invoquez beaucoup Allah afin que vous réussissiez. » (sens)' },
  { kind: 'hadith', ref: 'Sahih Muslim 408', topic: 'Prière sur le Prophète ﷺ', text: '« Quiconque prie sur moi une fois, Allah prie sur lui dix fois. »' },
  { kind: 'hadith', ref: 'Jami‘ at-Tirmidhi 3383', topic: 'Tahlil', text: '« La meilleure des invocations est Lā ilāha illā-llāh… »' },
  { kind: 'hadith', ref: 'Sahih al-Bukhari 6307', topic: 'Istighfar', text: '« Par Allah, je demande pardon à Allah et je me repens à Lui plus de soixante-dix fois par jour. »' },
  { kind: 'hadith', ref: 'Sahih al-Bukhari 7405 ; Sahih Muslim 2675', topic: 'Dhikr', text: '« Je suis tel que Mon serviteur pense de Moi, et Je suis avec lui quand il M’invoque… » (hadith qudsi)' },
  { kind: 'hadith', ref: 'Sahih Muslim 2700', topic: 'Dhikr en groupe', text: '« Des gens ne s’assoient pas pour invoquer Allah sans que les anges les entourent, que la miséricorde les couvre, que la sérénité descende sur eux et qu’Allah les mentionne auprès de ceux qui sont auprès de Lui. »' },
  { kind: 'hadith', ref: 'Sahih al-Bukhari 6407', topic: 'Dhikr', text: '« L’exemple de celui qui invoque son Seigneur et de celui qui ne L’invoque pas est celui du vivant et du mort. »' },
  { kind: 'hadith', ref: 'Jami‘ at-Tirmidhi 484', topic: 'Prière sur le Prophète ﷺ', text: '« Les gens les plus proches de moi le Jour de la Résurrection sont ceux qui auront le plus prié sur moi. »' },
  { kind: 'hadith', ref: 'Sunan Abi Dawud 1047', topic: 'Vendredi', text: '« Parmi vos meilleurs jours est le vendredi… Multipliez-y la prière sur moi, car votre prière m’est présentée. »' },
  { kind: 'hadith', ref: 'Sahih al-Bukhari 3293 ; Sahih Muslim 2691', topic: 'Tahlil ×100', text: 'Celui qui dit cent fois par jour « Lā ilāha illā-llāhu waḥdahu lā sharīka lah… » reçoit la récompense de l’affranchissement de dix esclaves, cent bonnes actions sont inscrites, cent mauvaises effacées, et il est protégé de Satan ce jour-là jusqu’au soir.' },
];

export const MUQADDAM_NOTE =
  'Ces textes sont donnés pour aider la mémorisation. Le wird de la Tijaniyya se reçoit d’un muqaddam habilité : suivez son enseignement pour les horaires, les nombres, les conditions et les rattrapages.';

/** Présentation des trois pratiques (écran Programme Tijaniyya). */
export type Practice = { id: 'wird' | 'wazifa' | 'hailala'; ar: string; name: string; timing: string; timingAr: string; desc: string; steps: Step[]; uncounted?: boolean };
export const PRACTICES: Practice[] = [
  {
    id: 'wird',
    ar: 'الوِرْدُ اللَّازِم',
    name: 'Al-Wird al-Lazim',
    timing: 'Après Fajr et après ‘Asr',
    timingAr: 'بعد الفجر وبعد العصر',
    desc: 'Le wird obligatoire du tijani, récité deux fois par jour : le matin (après la prière de l’aube, jusqu’à la mi-journée) et le soir (après ‘Asr, jusqu’à ‘Isha), selon ce qui est couramment enseigné. C’est l’engagement central de la voie.',
    steps: WIRD.steps,
  },
  {
    id: 'wazifa',
    ar: 'الوَظِيفَة',
    name: 'Al-Wazifa',
    timing: 'Une fois par jour, matin ou soir',
    timingAr: 'مرة في اليوم صباحاً أو مساءً',
    desc: 'La wazifa se récite au moins une fois par jour, de préférence en groupe (halqa) et en état de pureté rituelle, souvent après ‘Asr ou après Maghrib. Elle contient la Jawharat al-Kamal.',
    steps: WAZIFA.steps,
  },
  {
    id: 'hailala',
    ar: 'هَيْلَلَة الجُمُعَة',
    name: 'Hailala al-Jumu‘a',
    timing: 'Vendredi, de ‘Asr au Maghrib',
    timingAr: 'يوم الجمعة من العصر إلى المغرب',
    desc: HAILALA_FRIDAY.text,
    steps: [{ formula: 'hailala', count: 0, extra: 'Sans compter précisément, jusqu’au coucher du soleil.' }],
    uncounted: true,
  },
];

export const SHAYKH = {
  ar: 'الشيخ أحمد بن محمد التجاني',
  name: 'Shaykh Ahmad ibn Muhammad al-Tijani',
  born: 'Né en 1150 H / 1737 à ‘Aïn Madhi (Algérie)',
  died: 'Décédé en 1230 H / 1815 à Fès (Maroc)',
  silsila: 'Selon la tradition de la voie, le wird lui a été transmis directement par le Prophète ﷺ, à l’état de veille, en 1196 H / 1781-1782 (Abu Samghun).',
  shrine: 'Mausolée : Zaouïa tijaniyya, Fès',
  desc: 'Savant malikite et maître soufi, il fonda la Tariqa Tijaniyya, aujourd’hui l’une des voies les plus répandues, de l’Afrique du Nord et de l’Ouest jusqu’au monde entier. Sa voie repose sur trois piliers :',
  pillars: ['Le repentir sincère (tawba)', 'L’éloignement de l’interdit', 'L’accomplissement fidèle du wird'],
};
