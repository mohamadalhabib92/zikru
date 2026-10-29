/**
 * Fiqh pratique — un « jugement » (ruling) = une liste d’éléments d’UNE école, avec sa source précise
 * (livre, chapitre/bāb, page de l’édition imprimée ou vers cité) et un extrait arabe recopié de cette édition.
 * Règle : rien n’est ajouté sans source citable ; ce qui manque est listé dans FIQH_GAPS.
 * Tout est « à valider » tant qu’une personne de savoir ne l’a pas relu (statut par jugement).
 * Les résumés français sont des traductions de sens des extraits arabes, rédigées pour l’app.
 */
import type { ReviewStatus } from './provenance-types';

export type School = 'maliki' | 'shafii' | 'hanafi' | 'hanbali';
/** Ordre d’affichage : malikite et chaféite au premier plan (demande du propriétaire), puis hanafite et hanbalite. */
export const SCHOOLS: School[] = ['maliki', 'shafii', 'hanafi', 'hanbali'];
export const SCHOOL_LABEL: Record<School, { fr: string; en: string; ar: string; imam: string }> = {
  maliki: { fr: 'Malikite', en: 'Maliki', ar: 'المالكي', imam: 'Imam Mālik ibn Anas' },
  shafii: { fr: 'Chaféite', en: 'Shafi‘i', ar: 'الشافعي', imam: 'Imam ash-Shāfi‘ī' },
  hanafi: { fr: 'Hanafite', en: 'Hanafi', ar: 'الحنفي', imam: 'Imam Abū Ḥanīfa' },
  hanbali: { fr: 'Hanbalite', en: 'Hanbali', ar: 'الحنبلي', imam: 'Imam Aḥmad ibn Ḥanbal' },
};

export type Topic = 'wudu' | 'ghusl' | 'tayammum' | 'salat';
export const TOPICS: { id: Topic; title: string; ar: string; icon: string }[] = [
  { id: 'wudu', title: 'Les ablutions (wudu)', ar: 'الوضوء', icon: 'water' },
  { id: 'ghusl', title: 'Le grand lavage (ghusl)', ar: 'الغسل', icon: 'rainy' },
  { id: 'tayammum', title: 'Les ablutions sèches (tayammum)', ar: 'التيمم', icon: 'leaf' },
  { id: 'salat', title: 'La prière (salat)', ar: 'الصلاة', icon: 'body' },
];

export type FiqhSource = {
  /** Titre du livre (translittéré). */
  book: string;
  author: string;
  /** Chapitre / bāb / faṣl, en arabe et translittéré. */
  chapter: string;
  /** Page(s) de l’édition imprimée, ou « faṣl » si l’édition n’est pas paginée. */
  page: string;
  edition: string;
  url?: string;
};
export type FiqhRuling = {
  id: string;
  topic: Topic;
  school: School;
  /** 'intro' = conditions d’application (causes, cas permis) ; 'list' = liste de prescriptions. */
  kind: 'intro' | 'list';
  title: { fr: string; en?: string; ar?: string };
  items: string[];
  /** Extrait arabe recopié de l’édition citée (orthographe de l’édition, y compris ses coquilles). */
  textAr: string;
  source: FiqhSource;
  also?: FiqhSource[];
  /** Preuve (Coran / hadith) — uniquement si citée par la source ou évidente (verset des ablutions). */
  evidence?: string[];
  /** Remarque pour le relecteur (écart entre manuels, texte lacunaire…). */
  note?: string;
  status: ReviewStatus;
};

// ——— Éditions citées ———
export const ED = {
  mayyara: {
    book: 'al-Murshid al-Mu‘īn (Ibn ‘Āshir), vers cités dans al-Durr ath-Thamīn de Mayyāra',
    author: '‘Abd al-Wāḥid Ibn ‘Āshir (m. 1040 H) ; commentaire de Muḥammad Mayyāra (m. 1072 H)',
    edition: 'al-Durr ath-Thamīn, taḥqīq ‘Abd Allāh al-Minshāwī, Dār al-Ḥadīth, Le Caire, 1429 H / 2008 (pagination imprimée ; Shamela n° 14249). Numérotation des vers du Murshid : à confirmer selon l’édition du matn.',
    url: (idx: number) => `https://shamela.ws/book/14249/${idx}`,
  },
  risala: {
    book: 'ar-Risāla',
    author: 'Ibn Abī Zayd al-Qayrawānī (m. 386 H)',
    edition: 'Matn ar-Risāla, Dār al-Fikr (pagination imprimée ; Shamela n° 11373)',
    url: (idx: number) => `https://shamela.ws/book/11373/${idx}`,
  },
  shuja: {
    book: 'Matn Abī Shujā‘ (al-Ghāya wa-t-Taqrīb)',
    author: 'Abū Shujā‘ al-Aṣfahānī (m. 593 H)',
    edition: '‘Ālam al-Kutub (pagination imprimée ; Shamela n° 11370)',
    url: (idx: number) => `https://shamela.ws/book/11370/${idx}`,
  },
  safina: {
    book: 'Safīnat an-Najā',
    author: 'Sālim ibn Sumayr al-Ḥaḍramī (m. 1271 H)',
    edition: 'Matn Safīnat an-Najā, islamarchive.cc (livre n° 25509, 19 pages web, sans édition imprimée indiquée) : cité par faṣl et page web',
    url: (p: number) => `https://islamarchive.cc/ketab_content/25509/p-${p}`,
  },
  minhaj: {
    book: 'Minhāj aṭ-Ṭālibīn',
    author: 'an-Nawawī (m. 676 H)',
    edition: 'taḥqīq ‘Awaḍ Qāsim Aḥmad ‘Awaḍ, Dār al-Fikr, 1re éd., 1425 H / 2005 (pagination imprimée ; Shamela n° 12096)',
    url: (idx: number) => `https://shamela.ws/book/12096/${idx}`,
  },
  nur: {
    book: 'Nūr al-Īḍāḥ wa Najāt al-Arwāḥ',
    author: 'Ḥasan ash-Shurunbulālī (m. 1069 H)',
    edition: 'taḥqīq Muḥammad Anīs Mahrāt, al-Maktaba al-‘Aṣriyya, 2005 (pagination imprimée ; Shamela n° 12117)',
    url: (idx: number) => `https://shamela.ws/book/12117/${idx}`,
  },
  umda: {
    book: '‘Umdat al-Fiqh',
    author: 'Ibn Qudāma al-Maqdisī (m. 620 H)',
    edition: 'taḥqīq Aḥmad Muḥammad ‘Azzūz, al-Maktaba al-‘Aṣriyya, 1425 H / 2004 (pagination imprimée ; Shamela n° 11315)',
    url: (idx: number) => `https://shamela.ws/book/11315/${idx}`,
  },
};
export type EdKey = keyof typeof ED;
export function src(ed: EdKey, chapter: string, page: string, idx: number): FiqhSource {
  const e = ED[ed];
  return { book: e.book, author: e.author, chapter, page, edition: e.edition, url: e.url(idx) };
}
const A = 'a_valider' as const;
const WUDU_VERSE = 'Coran 5:6 (verset des ablutions)';

const NAWAQID_COMMON = ['Tout ce qui sort des deux voies naturelles (urine, selles, gaz, liquide prostatique…).', 'La perte de conscience : sommeil profond, évanouissement, ivresse, folie.'];

export const RULINGS: FiqhRuling[] = [
  // ═════════ MALIKITE — Ibn ‘Āshir (vers) via Mayyāra ; ar-Risāla ═════════
  {
    id: 'maliki-wudu-faraid', topic: 'wudu', school: 'maliki', kind: 'list',
    title: { fr: 'Les 7 obligations (fara’id)', ar: 'فرائض الوضوء' },
    items: ['L’intention (niyya), au moment de laver le visage.', 'Laver le visage.', 'Laver les mains et avant-bras jusqu’aux coudes inclus.', 'Passer les mains mouillées sur toute la tête (mash).', 'Laver les pieds jusqu’aux chevilles incluses.', 'Le frottement (dalk) de chaque membre.', 'L’enchaînement sans interruption (fawr / muwalat).'],
    textAr: 'فَرائِضُ الْوُضُو سَبْعٌ وهِي ... دَلْكُ وفَوْرٌ نِيَّةٌ فى بَدْئِهِ ... وغَسْلُ وجْهٍ غَسْلُهُ الْيَدَيْنِ ... ومَسْحُ رَاسٍ غَسْلُهُ الرِّجْلَيْنِ',
    source: src('mayyara', 'Kitāb aṭ-ṭahāra — faṣl farā’iḍ al-wuḍū’ (فصل فرائض الوضوء)', 'p. 149-150', 145),
    evidence: [WUDU_VERSE], status: A,
  },
  {
    id: 'maliki-wudu-sunan', topic: 'wudu', school: 'maliki', kind: 'list',
    title: { fr: 'Les 7 sunan', ar: 'سنن الوضوء' },
    items: ['Laver les mains jusqu’aux poignets au début.', 'Ramener les mains sur la tête (radd al-mash).', 'Essuyer les oreilles.', 'Se rincer la bouche (madmada).', 'Aspirer l’eau par le nez (istinshaq).', 'La rejeter (istinthar).', 'Respecter l’ordre des membres obligatoires (tartib).'],
    textAr: 'سُنَنُهُ السَّبْعُ ابْتدَاء غَسلُ الْيَدَيْنِ ... وَرَدُّ مَسْحِ الرّاسِ مَسْحُ الأُذُنَيْنِ ... مَضْمَضةُ اُسْتِنْشَاقٌ اُستِنْثَارُ ... تَرْتيب فَرْضُهُ وَذَا الْمُخْتارُ',
    source: src('mayyara', 'faṣl sunan al-wuḍū’', 'p. 161', 157),
    note: 'Avant P3, l’app listait 6 sunan dont « eau renouvelée pour les oreilles » ; aligné ici sur les 7 sunan du vers. Les 11 fada’il (tasmiya, siwak…) sont p. 164.',
    status: A,
  },
  {
    id: 'maliki-wudu-nawaqid', topic: 'wudu', school: 'maliki', kind: 'list',
    title: { fr: 'Ce qui annule les ablutions (16 selon Ibn ‘Ashir)', ar: 'نواقض الوضوء' },
    items: [...NAWAQID_COMMON, 'Toucher ou embrasser une personne, si l’on recherche ou ressent le plaisir.', 'Toucher son sexe (mass adh-dhakar).', 'Le doute sur la persistance de ses ablutions (on les refait).', 'L’apostasie (kufr).'],
    textAr: 'نَواقِضُهُ سِتَّ عَشَرْ ... بَوْلٌ ورِيحٌ سَلَسٌ إِذَا نَدَرْ ... وغائِطٌ نَومٌ ثَقيِلٌ مَذْيُ ... سُكْرٌ وإِغْماءُ جُنُونٌ ودْيُ ... لَمْسٌ وقُبْلَةٌ وذَا إنْ وُجِدَتْ ... لَذَّةُ عادَة كَذَا إنْ قُصِدتْ ... إلْطافُ مَرْأَةٍ كَذا مَسُّ الذَّكَرْ ... والشّكُّ فى الْحَدَثِ كُفْرُ مَنْ كَفَر',
    source: src('mayyara', 'faṣl nawāqiḍ al-wuḍū’', 'p. 170', 166),
    note: 'La précision « avec la paume ou l’intérieur des doigts » (affichée avant P3) relève du commentaire, pas du vers : retirée du résumé, à confirmer par le relecteur. Ajout : l’apostasie (« كفر من كفر »).',
    status: A,
  },
  {
    id: 'maliki-ghusl-causes', topic: 'ghusl', school: 'maliki', kind: 'intro',
    title: { fr: 'Quand est-il obligatoire ?', ar: 'موجبات الغسل' },
    items: ['Après l’état de janaba (rapport — pénétration du gland —, émission de sperme), et à la fin des règles ou des lochies.'],
    textAr: 'مُوجِبهُ حَيْضٌ نِفاسٌ انْزالُ ... مَغِيبُ كَمْرَةٍ بِفَرْجٍ',
    source: src('mayyara', 'faṣl mūjibāt al-ghusl', 'p. 200', 194), status: A,
  },
  {
    id: 'maliki-ghusl-faraid', topic: 'ghusl', school: 'maliki', kind: 'list',
    title: { fr: 'Les obligations', ar: 'فروض الغسل' },
    items: ['L’intention.', 'L’enchaînement sans interruption (fawr / muwalat).', 'Faire parvenir l’eau sur tout le corps (ta‘mim).', 'Le frottement (dalk).', 'Faire pénétrer l’eau dans les cheveux (takhlil ash-sha‘r).'],
    textAr: 'فُرُوضُ الغَسلِ قَصْدٌ يُحتَضرْ ... فَوْرٌ عُمومُ الدَّلْك تَخْلِيلُ الشّعرَ',
    source: src('mayyara', 'faṣl farā’iḍ al-ghusl', 'p. 192', 188),
    note: 'Avant P3 : 4 obligations ; le vers en compte 5 (ajout du takhlil des cheveux).', status: A,
  },
  {
    id: 'maliki-tayammum-causes', topic: 'tayammum', school: 'maliki', kind: 'intro',
    title: { fr: 'Quand est-il permis ?', ar: 'أسباب التيمم' },
    items: ['En l’absence d’eau, ou si son usage fait craindre un mal (maladie, froid extrême…), une fois l’heure de la prière entrée.'],
    textAr: 'لِخَوفِ ضُرٍّ أَو عَدَمِ ما ... عَوِّضْ مِنَ الطَّهارةِ التَّيَمُّما',
    source: src('mayyara', 'faṣl at-tayammum', 'p. 211', 205), evidence: ['Coran 4:43', 'Coran 5:6'], status: A,
  },
  {
    id: 'maliki-tayammum-faraid', topic: 'tayammum', school: 'maliki', kind: 'list',
    title: { fr: 'Les 8 obligations', ar: 'فرائض التيمم' },
    items: ['Essuyer tout le visage.', 'Essuyer les mains jusqu’aux poignets (kū‘) — jusqu’aux coudes : sunna.', 'L’intention.', 'La première frappe (poser les mains sur la terre).', 'L’enchaînement (muwalat).', 'Une terre pure (sa‘id : terre, sable, pierre…).', 'Le relier aussitôt à la prière (wasl).', 'Que l’heure de la prière soit entrée.'],
    textAr: 'فَرضُهُ [في نسخة الشاملة: «مسح مسحك»] مَسْحُكَ وجْها والْيَدَيْنِ ... للْكُوعِ والنِّيَّةُ أُولى الضَّرْبَتينِ ... ثمَّ المُوالاةُ صَعِيدٌ طَهَرا ... ووصْلُها بهِ ووقْتٌ حَضَرا',
    source: src('mayyara', 'faṣl farā’iḍ at-tayammum', 'p. 219-220', 213),
    also: [src('mayyara', 'sunan at-tayammum (« سننه مسحهما للمرفق وضربة اليدين ترتيب »)', 'p. 225', 219)],
    note: 'Avant P3 : 5 obligations résumées ; aligné sur les 8 du vers.', status: A,
  },
  {
    id: 'maliki-salat-faraid', topic: 'salat', school: 'maliki', kind: 'list',
    title: { fr: 'Les obligations (fara’id, 16 selon Ibn ‘Ashir)', ar: 'فرائض الصلاة' },
    items: ['L’intention.', 'Le takbir d’ouverture (takbirat al-ihram) et la station debout pour lui.', 'La Fatiha et la station debout pour elle.', 'L’inclinaison (ruku‘) et le redressement.', 'La prosternation (sujud) et le redressement entre les deux.', 'Le salam final et la position assise pour lui.', 'La sérénité (tuma’nina) et l’équilibre (i‘tidal) dans chaque position.', 'Respecter l’ordre des actes.', 'Derrière un imam : le suivre au takbir d’ouverture et au salam, avec l’intention de le suivre (iqtida’).'],
    textAr: 'فَرائِضُ الصَّلاَةِ سِتَّ عشَرَهْ ... شُرُوطُها أَرْبَعَةٌ مُفْتَقِرهْ ... [تكبيرة] الاحْرامِ والْقِيامْ لَها وَنِيَّةٌ بِها تُرام ... فاتِحَةٌ مَعَ الْقِيام [في نسخة الشاملة: «القهيام»] والرُّكُوعْ والرَّفْعُ والسُّجُودُ بالخُضُوعْ ... والرَّفْعُ مِنْهُ والسَّلاَمُ والْجُلُوسْ لَهُ وتَرْتِيبُ أَدَاءٍ ... والاِعْتِدالُ مُطْمَئِنا بالتِزامْ ... تَبَع مَامُومٌ بإِحْرَامٍ سَلاَم ... نِيَّتُهُ اقْتِدا [في نسخة الشاملة: «افتداء»]',
    source: src('mayyara', 'Kitāb aṣ-ṣalāt — faṣl farā’iḍ aṣ-ṣalāt', 'p. 235-237', 229),
    note: 'Ajout P3 : obligations du ma’mum (vers p. 237). Le vers sur l’imam (khawf, jam‘, jumu‘a, mustakhlaf) n’est pas résumé.', status: A,
  },
  {
    id: 'maliki-salat-shurut', topic: 'salat', school: 'maliki', kind: 'list',
    title: { fr: 'Les 4 conditions de validité', ar: 'شروط الصلاة' },
    items: ['Se tourner vers la qibla.', 'Pureté du corps, du vêtement et du lieu (de la najasa).', 'Couvrir sa ‘awra.', 'Être en état de pureté rituelle (ablutions).'],
    textAr: 'شَرطُها الاِستقْبَالُ طُهْرُ الخْبَثِ ... وستْرُ عَوْرَةٍ وطُهْرُ الحَدَثِ ... بالذِّكْرِ والْقُدرَةِ في غيْرِ الاخِيرْ',
    source: src('mayyara', 'faṣl shurūṭ aṣ-ṣalāt', 'p. 249', 243),
    note: 'Selon le vers, la pureté de la najasa et l’orientation sont conditionnées au souvenir et à la capacité.', status: A,
  },
  {
    id: 'maliki-salat-wujub', topic: 'salat', school: 'maliki', kind: 'list',
    title: { fr: 'Conditions d’obligation', ar: 'شروط الوجوب' },
    items: ['Que l’heure de la prière soit entrée.', 'Être purifiée du sang des règles ou des lochies.'],
    textAr: 'شَرْطُ وُجُوبِها النَّقا مِنَ الدَّمِ ... بقَصَّةٍ أَوِ الْجفُوفِ ... ثُمَّ دُخُولُ وَقْتٍ',
    source: src('mayyara', 'faṣl shurūṭ wujūb aṣ-ṣalāt', 'p. 265', 259),
    note: 'Avant P3, « l’heure entrée » figurait parmi les conditions de validité ; chez Ibn ‘Ashir c’est une condition d’obligation.', status: A,
  },

  // ═════════ CHAFÉITE — Safīnat an-Najā ; Matn Abī Shujā‘ ; Minhāj ═════════
  {
    id: 'shafii-wudu-faraid', topic: 'wudu', school: 'shafii', kind: 'list',
    title: { fr: 'Les 6 obligations (fara’id)', ar: 'فروض الوضوء' },
    items: ['L’intention (niyya), au moment de laver le visage.', 'Laver le visage.', 'Laver les mains et avant-bras jusqu’aux coudes inclus.', 'Essuyer une partie de la tête (mash), même minime.', 'Laver les pieds jusqu’aux chevilles incluses.', 'Respecter l’ordre (tartib).'],
    textAr: 'فروض الوضوء ستة: الأول: النية، الثاني: غسل الوجه، الثالث: غسل اليدين مع المرفقين، الرابع: مسح شيء من الرأس، الخامس: غسل الرجلين مع الكعبين، السادس: الترتيب.',
    source: src('safina', 'faṣl furūḍ al-wuḍū’', 'faṣl, page web 1', 1),
    also: [src('shuja', 'Kitāb aṭ-ṭahāra — farā’iḍ al-wuḍū’ (ستة أشياء)', 'p. 3-4', 2)],
    evidence: [WUDU_VERSE], status: A,
  },
  {
    id: 'shafii-wudu-sunan', topic: 'wudu', school: 'shafii', kind: 'list',
    title: { fr: 'Les 10 sunan (Abu Shuja‘)', ar: 'سنن الوضوء' },
    items: ['Dire « Bismillah » (tasmiya).', 'Laver les mains avant de les plonger dans le récipient.', 'Rinçage de la bouche (madmada).', 'Rinçage du nez (istinshaq).', 'Essuyer les oreilles, dehors et dedans, avec une eau nouvelle.', 'Passer les doigts dans la barbe épaisse.', 'Passer l’eau entre les doigts des mains et des pieds.', 'Commencer par la droite.', 'Laver chaque membre trois fois.', 'Enchaîner sans interruption (muwalat).'],
    textAr: 'وسننه عشرة أشياء: التسمية وغسل الكفين قبل إدخالهما الإناء والمضمضة والاستنشاق ومسح الأذنين ظاهرهما وباطنهما بماء جديد وتخليل اللحية الكثة وتخليل أصابع اليدين والرجلين وتقديم اليمنى على اليسرى والطهارة ثلاثا ثلاثا والموالاة.',
    source: src('shuja', 'Kitāb aṭ-ṭahāra — sunan al-wuḍū’', 'p. 4', 3),
    note: 'Avant P3 : liste de 6 « sunan principales » incluant siwak et essuyage de toute la tête, absents de cette liste d’Abu Shuja‘ ; remplacée par les 10 sunan du texte.', status: A,
  },
  {
    id: 'shafii-wudu-nawaqid', topic: 'wudu', school: 'shafii', kind: 'list',
    title: { fr: 'Ce qui annule les ablutions', ar: 'نواقض الوضوء' },
    items: [...NAWAQID_COMMON.map((x, i) => (i === 1 ? 'La perte de la raison : sommeil (sauf assis bien calé), évanouissement, ivresse, folie.' : x)), 'Le contact de peau à peau, sans écran, entre un homme et une femme adultes non mahram (même sans désir).', 'Toucher le sexe (le sien ou celui d’autrui) ou l’anneau anal avec l’intérieur de la main.'],
    textAr: 'نواقض [في المصدر: «نوا قض»] الوضوء أربعة أشياء: (الأول) الخارج من أحد السبيلين من قبل أو دبر ريح أو غيره إلا المنى، (الثاني) زوال العقل بنوم أو غيره إلا نوم قاعد ممكن مقعده من الأرض، (الثالث) التقاء بشرتي رجل وامرأة كبيرين من غير حائل، (الرابع) مس قبل الآدمي أو حلقة دبره ببطن الراحة أو بطون الأصابع.',
    source: src('safina', 'faṣl nawāqiḍ al-wuḍū’', 'faṣl, page web 2', 2),
    also: [src('shuja', 'faṣl mā yanquḍ al-wuḍū’ (ستة أشياء)', 'p. 4', 3)], status: A,
  },
  {
    id: 'shafii-ghusl-causes', topic: 'ghusl', school: 'shafii', kind: 'intro',
    title: { fr: 'Quand est-il obligatoire ?', ar: 'موجبات الغسل' },
    items: ['Pénétration du gland, émission de sperme, règles, lochies, accouchement, décès (lavage du défunt).'],
    textAr: 'موجبات الغسل ستة: إيلاج الحشفة في الفرج، وخروج المنى والحيض والنفاس والولادة والموت.',
    source: src('safina', 'faṣl mūjibāt al-ghusl', 'faṣl, page web 2', 2),
    also: [src('shuja', 'faṣl mā yūjib al-ghusl', 'p. 4-5', 3)], status: A,
  },
  {
    id: 'shafii-ghusl-faraid', topic: 'ghusl', school: 'shafii', kind: 'list',
    title: { fr: 'Obligations', ar: 'فروض الغسل' },
    items: ['L’intention.', 'Faire parvenir l’eau sur tout le corps, peau et cheveux compris.'],
    textAr: 'فروض الغسل اثنان: النية، وتعميم البدن بالماء.',
    source: src('safina', 'faṣl furūḍ al-ghusl', 'faṣl, page web 2', 2),
    also: [src('shuja', 'faṣl farā’iḍ al-ghusl (« النية وإزالة النجاسة إن كانت على بدنه وإيصال الماء إلى جميع الشعر والبشرة »)', 'p. 5', 4)],
    note: 'Safina : 2 obligations ; Abu Shuja‘ : 3 (ajoute « retirer la najasa s’il y en a »). Écart à faire trancher par le relecteur.', status: A,
  },
  {
    id: 'shafii-ghusl-sunan', topic: 'ghusl', school: 'shafii', kind: 'list',
    title: { fr: 'Sunan (Abu Shuja‘)', ar: 'سنن الغسل' },
    items: ['Dire « Bismillah ».', 'Faire les ablutions avant.', 'Passer la main sur le corps.', 'Enchaîner sans interruption.', 'Commencer par la droite.'],
    textAr: 'وسننه خمسة أشياء: التسمية والوضوء قبله وإمرار اليد على الجسد والموالاة وتقديم اليمنى على اليسرى.',
    source: src('shuja', 'faṣl farā’iḍ al-ghusl wa sunanuhu', 'p. 5', 4),
    note: 'Avant P3 : « laver trois fois » figurait ici ; absent de cette liste, retiré.', status: A,
  },
  {
    id: 'shafii-tayammum-shurut', topic: 'tayammum', school: 'shafii', kind: 'intro',
    title: { fr: 'Quand est-il permis ?', ar: 'شرائط التيمم' },
    items: ['En cas d’excuse (voyage, maladie), après l’entrée de l’heure, après avoir cherché l’eau en vain ou s’il est impossible de l’utiliser, avec une poussière (turab) pure.'],
    textAr: 'وشرائط التيمم خمسة أشياء: وجود العذر بسفر أو مرض ودخول وقت الصلاة وطلب الماء وتعذر استعماله وإعوازه بعد الطلب والتراب الطاهر له غبار.',
    source: src('shuja', 'faṣl sharā’iṭ at-tayammum', 'p. 6', 5),
    also: [src('safina', 'faṣl shurūṭ at-tayammum (dix conditions)', 'faṣl, page web 2', 2)],
    evidence: ['Coran 4:43', 'Coran 5:6'], status: A,
  },
  {
    id: 'shafii-tayammum-faraid', topic: 'tayammum', school: 'shafii', kind: 'list',
    title: { fr: 'Les 5 obligations', ar: 'فروض التيمم' },
    items: ['Prendre de la poussière pure avec les mains (naql).', 'L’intention.', 'Essuyer le visage.', 'Essuyer les mains et avant-bras jusqu’aux coudes.', 'Respecter l’ordre entre les deux essuyages.'],
    textAr: 'فروض التيمم خمسة: الأول: نقل التراب، الثاني: النية، الثالث: مسح الوجه، الرابع: مسح اليدين إلى المرفقين، الخامس: الترتيب بين المسحتين.',
    source: src('safina', 'faṣl furūḍ at-tayammum', 'faṣl, page web 2', 2),
    note: 'Abu Shuja‘ p. 6 en annonce 4 mais l’édition Shamela n’en énumère que 3 (« مسح الوجه » semble omis) : texte à vérifier sur l’imprimé.', status: A,
  },
  {
    id: 'shafii-salat-arkan', topic: 'salat', school: 'shafii', kind: 'list',
    title: { fr: 'Les 13 piliers (arkan, an-Nawawi)', ar: 'أركان الصلاة' },
    items: ['L’intention.', 'Le takbir d’ouverture.', 'La station debout (si on le peut).', 'La Fatiha.', 'Le ruku‘ avec sérénité (tuma’nina).', 'Le redressement (i‘tidal) avec sérénité.', 'Les deux prosternations avec sérénité.', 'La position assise entre elles, avec sérénité.', 'Le dernier tashahhud.', 'La position assise pour celui-ci.', 'La prière sur le Prophète ﷺ dans ce tashahhud.', 'Le premier salam.', 'L’ordre (tartib).'],
    textAr: 'أركانها ثلاثة عشر',
    source: src('minhaj', 'Kitāb aṣ-ṣalāt — bāb ṣifat aṣ-ṣalāt', 'p. 25', 25),
    also: [src('shuja', 'faṣl arkān aṣ-ṣalāt (« ثمانية عشر ركنا », la tuma’nina comptée à part)', 'p. 9', 8)],
    note: 'Abu Shuja‘ compte 18 arkan (tuma’nina et basmala détaillées) ; même contenu, autre décompte.', status: A,
  },
  {
    id: 'shafii-salat-shurut', topic: 'salat', school: 'shafii', kind: 'list',
    title: { fr: 'Conditions de validité (avant d’entrer en prière)', ar: 'شرائط الصلاة' },
    items: ['Être en état de pureté (du hadath).', 'Pureté du corps, du vêtement et du lieu.', 'Couvrir sa ‘awra.', 'Se tourner vers la qibla.', 'Connaître l’entrée de l’heure.'],
    textAr: 'وشرائط الصلاة قبل الدخول فيها خمسة أشياء: طهارة الأعضاء من الحدث والنجس وستر العورة بلباس طاهر والوقوف على مكان طاهر والعلم بدخول الوقت واستقبال القبلة.',
    source: src('shuja', 'faṣl sharā’iṭ aṣ-ṣalāt', 'p. 8', 7),
    also: [src('safina', 'faṣl shurūṭ aṣ-ṣalāt (huit conditions)', 'faṣl, page web 3', 3)], status: A,
  },

  // ═════════ HANAFITE — Nūr al-Īḍāḥ (ash-Shurunbulālī) ═════════
  {
    id: 'hanafi-wudu-faraid', topic: 'wudu', school: 'hanafi', kind: 'list',
    title: { fr: 'Les 4 obligations (arkan / fara’id)', ar: 'أركان الوضوء' },
    items: ['Laver le visage (du haut du front au bas du menton, d’un lobe d’oreille à l’autre).', 'Laver les mains avec les coudes.', 'Laver les pieds avec les chevilles.', 'Essuyer le quart de la tête.'],
    textAr: 'أركان الوضوء أربعة وهي فرائضه: الأول: غسل الوجه ... والثاني: غسل يديه مع مرفقيه والثالث: غسل رجليه مع كعبيه والرابع: مسح ربع رأسه.',
    source: src('nur', 'Kitāb aṭ-ṭahāra — faṣl fī l-wuḍū’', 'p. 20', 14), evidence: [WUDU_VERSE], status: A,
  },
  {
    id: 'hanafi-wudu-sunan', topic: 'wudu', school: 'hanafi', kind: 'list',
    title: { fr: 'Sunan principales (18 selon Nur al-Idah)', ar: 'سنن الوضوء' },
    items: ['Laver les mains jusqu’aux poignets ; dire « Bismillah » au début ; le siwak.', 'Rincer la bouche trois fois et le nez par trois poignées d’eau (avec insistance, sauf jeûneur).', 'Passer les doigts dans la barbe épaisse et entre les doigts.', 'Laver trois fois.', 'Essuyer toute la tête une fois, et les oreilles.', 'Le frottement (dalk) et l’enchaînement (wala’).', 'L’intention et l’ordre (tartib) — sunna chez les hanafites.', 'Commencer par la droite ; essuyer la nuque.'],
    textAr: 'يسن في الوضوء ثمانية عشر شيئا: غسل اليدين إلى الرسغين. والتسمية ابتداء. والسواك ... والمضمضة ثلاثا ... والاستنشاق بثلاث غرفات ... وتخليل اللحية الكثة ... وتخليل الأصابع. وتثليث الغسل. واستيعاب الرأس بالمسح مرة. ومسح الأذنين ... والدلك. والولاء. والنية. والترتيب ... والبداءة بالميامن ... ومسح الرقبة لا الحلقوم.',
    source: src('nur', 'faṣl fī sunan al-wuḍū’', 'p. 22', 18), status: A,
  },
  {
    id: 'hanafi-wudu-nawaqid', topic: 'wudu', school: 'hanafi', kind: 'list',
    title: { fr: 'Ce qui annule les ablutions (12)', ar: 'نواقض الوضوء' },
    items: ['Ce qui sort des deux voies.', 'Une impureté qui coule d’ailleurs (sang, pus).', 'L’accouchement, même sans sang.', 'Le vomissement qui remplit la bouche.', 'Le sang qui domine la salive ou l’égale.', 'Le sommeil où l’assise n’est pas calée au sol, ou si elle se soulève avant le réveil.', 'L’évanouissement, la folie, l’ivresse.', 'L’éclat de rire d’un adulte éveillé dans une prière avec ruku‘ et sujud.', 'Le contact direct des sexes en érection, sans écran.'],
    textAr: 'ينقض الوضوء اثنا عشرة شيئا: ما خرج من السبيلين إلا ريح القبل في الأصح. ونجاسة سائلة من غيرهما: كدم وقيح. وينقضه ولادة من غير رؤية دم. ... وقيء ... إذا ملأ الفم ... ودم غلب على البزاق أو ساواه. ونوم لم تتمكن فيه المقعدة من الأرض. وارتفاع مقعدة نائم قبل انتباهه ... وإغماء. وجنون. وسكر. وقهقهة بالغ يقظان في صلاة ذات ركوع وسجود ... ومس فرج بذكر منتصب بلا حائل.',
    source: src('nur', 'faṣl fī nawāqiḍ al-wuḍū’', 'p. 25-26', 24),
    note: 'Chez les hanafites, toucher son sexe ou une femme n’annule pas les ablutions (absent de la liste).', status: A,
  },
  {
    id: 'hanafi-ghusl-faraid', topic: 'ghusl', school: 'hanafi', kind: 'list',
    title: { fr: 'Les obligations (11 points, en résumé 3)', ar: 'فرائض الغسل' },
    items: ['Laver l’intérieur de la bouche.', 'Laver l’intérieur du nez.', 'Laver une fois tout le corps — y compris nombril, trous non refermés, peau sous la barbe, la moustache et les sourcils, parties externes du sexe.'],
    textAr: 'يفترض في الاغتسال أحد عشر شيئا: غسل الفم. والأنف. والبدن مرة. وداخل قلفة لا عسر في فسخها. وسرة. وثقب غير منضم. وداخل المضفور من شعر الرجل مطلقا لا المضفور من شعر المرأة إن سرى الماء في أصوله. وبشرة اللحية. وبشرة الشارب. والحاجب. والفرج الخارج.',
    source: src('nur', 'faṣl mā yuftaraḍ fī l-ightisāl', 'p. 28', 31),
    note: 'L’intention est une sunna du ghusl chez les hanafites (sunan p. 29).', status: A,
  },
  {
    id: 'hanafi-tayammum-shurut', topic: 'tayammum', school: 'hanafi', kind: 'list',
    title: { fr: 'Les 8 conditions de validité', ar: 'شروط صحة التيمم' },
    items: ['L’intention (au moment de frapper la terre).', 'Une excuse : eau éloignée d’un mille, maladie, froid dangereux, peur (ennemi, soif)…', 'Une matière pure de la nature de la terre (terre, pierre, sable).', 'Couvrir entièrement les parties essuyées.', 'Essuyer avec toute la main ou la plus grande partie.', 'Deux frappes avec l’intérieur des paumes.', 'L’absence de ce qui l’annule (règles, lochies, hadath).', 'Retirer ce qui empêche l’essuyage (cire, graisse).'],
    textAr: 'يصح التيمم بشروط ثمانية: الأول: النية ... الثاني: العذر المبيح للتيمم ... الثالث: أن يكون التيمم بطاهر من جنس الأرض ... الرابع: استيعاب المحل بالمسح. الخامس: أن يمسح بجميع اليد أو بأكثرها ... السادس: أن يكون بضربتين بباطن الكفين ... السابع: انقطاع ما ينافيه من حيض أو نفاس أو حدث. الثامن: زوال ما يمنع المسح كشمع وشحم.',
    source: src('nur', 'bāb at-tayammum', 'p. 32-33', 37), evidence: ['Coran 4:43', 'Coran 5:6'], status: A,
  },
  {
    id: 'hanafi-tayammum-arkan', topic: 'tayammum', school: 'hanafi', kind: 'list',
    title: { fr: 'Ses 2 piliers et 7 sunan', ar: 'ركنا التيمم وسننه' },
    items: ['Piliers : essuyer les mains et le visage.', 'Sunan : Bismillah au début, l’ordre, l’enchaînement, avancer puis reculer les mains dans la terre, les secouer, écarter les doigts.'],
    textAr: 'وركناه مسح اليدين والوجه. ... وسنن التيمم سبعة: التسمية في أوله. والترتيب. والموالاة. وإقبال اليدين بعد وضعهما في التراب. وإدبارهما. ونفضهما. وتفريج الأصابع.',
    source: src('nur', 'bāb at-tayammum', 'p. 33', 38), status: A,
  },
  {
    id: 'hanafi-salat-arkan', topic: 'salat', school: 'hanafi', kind: 'list',
    title: { fr: 'Les piliers (arkan)', ar: 'أركان الصلاة' },
    items: ['La station debout.', 'La récitation.', 'Le ruku‘.', 'Le sujud.', 'Selon un avis : la dernière position assise, le temps du tashahhud.'],
    textAr: 'والأركان من المذكورات أربعة: القيام. والقراءة. والركوع. والسجود. وقيل: القعود الأخير مقدار التشهد.',
    source: src('nur', 'Kitāb aṣ-ṣalāt — bāb shurūṭ aṣ-ṣalāt wa arkānihā', 'p. 52', 60), status: A,
  },
  {
    id: 'hanafi-salat-shurut', topic: 'salat', school: 'hanafi', kind: 'list',
    title: { fr: 'Conditions de validité (principales)', ar: 'شروط الصلاة' },
    items: ['Pureté du hadath.', 'Pureté du corps, du vêtement et du lieu (de la najasa non tolérée).', 'Couvrir la ‘awra.', 'Se tourner vers la qibla.', 'L’heure, et la conviction qu’elle est entrée.', 'L’intention et le takbir d’ouverture (tahrima).'],
    textAr: 'لابد لصحة الصلاة من سبعة وعشرين شيئا: الطهارة من الحدث. وطهارة الجسد. والثوب. والمكان من نجس غير معفو عنه ... وستر العورة ... واستقبال القبلة ... والوقت. واعتقاد دخوله. والنية. والتحريمة ...',
    source: src('nur', 'bāb shurūṭ aṣ-ṣalāt wa arkānihā', 'p. 50', 58),
    note: 'Nur al-Idah énumère 27 éléments (incluant les arkan et des détails de la tahrima) ; seuls les principaux sont résumés.', status: A,
  },
  {
    id: 'hanafi-salat-wajibat', topic: 'salat', school: 'hanafi', kind: 'list',
    title: { fr: 'Les obligations wajib (18) — oubli réparé par le sujud as-sahw', ar: 'واجبات الصلاة' },
    items: ['La Fatiha, et une sourate ou trois versets dans les deux premières rak‘as (et toutes celles du witr et du nafl).', 'La Fatiha avant la sourate.', 'Le nez avec le front au sujud ; la seconde prosternation avant de passer à autre chose.', 'La sérénité dans les piliers.', 'La première position assise et son tashahhud ; le tashahhud final.', 'Se lever pour la 3e rak‘a sans tarder après le tashahhud.', 'Le mot « as-salam ».', 'Le qunut du witr ; les takbirs des deux ‘Id.', 'L’imam récite à voix haute au Fajr, aux deux premières de Maghrib et ‘Isha, Jumu‘a, ‘Id, tarawih et witr de Ramadan ; à voix basse au Dhuhr et à l’‘Asr. Celui qui prie seul a le choix pour les prières à voix haute.'],
    textAr: 'وهو ثمانية عشر شيئا: قراءة الفاتحة. وضم سورة أو ثلاث آيات ... وتعيين القراءة في الأوليين. وتقديم الفاتحة على السورة. وضم الأنف للجبهة في السجود. والإتيان بالسجدة الثانية ... والاطمئنان في الأركان. والقعود [في نسخة الشاملة: «والعقود»] الأول. وقراءة التشهد فيه ... وقراءته في الجلوس الأخير. والقيام إلى الثالثة من غير تراخ ... ولفظ السلام ... وقنوت الوتر. وتكبيرات العيدين ... وجهر الإمام ... والإسرار ... والمنفرد مخير فيما يجهر.',
    source: src('nur', 'faṣl fī wājib aṣ-ṣalāt', 'p. 54-55', 64), status: A,
  },

  // ═════════ HANBALITE — ‘Umdat al-Fiqh (Ibn Qudāma) ═════════
  {
    id: 'hanbali-wudu-wajib', topic: 'wudu', school: 'hanbali', kind: 'list',
    title: { fr: 'Ce qui est obligatoire', ar: 'واجبات الوضوء' },
    items: ['L’intention.', 'Laver une fois chaque membre (le lavage des mains au début n’est pas obligatoire).', 'Essuyer toute la tête.', 'Respecter l’ordre.', 'L’enchaînement : ne pas tarder à laver un membre au point que le précédent sèche.'],
    textAr: 'والواجب من ذلك النية والغسل مرة مرة ما خلا الكفين ومسح الرأس كله وترتيب الوضوء على ما ذكرنا وأن لا يؤخر غسل عضو حتى ينشف ما قبله.',
    source: src('umda', 'Kitāb aṭ-ṭahāra — bāb al-wuḍū’', 'p. 16', 7), evidence: [WUDU_VERSE],
    note: '« Laver une fois » renvoie à la description qui précède dans le bāb (p. 15), qui inclut madmada et istinshaq ; à préciser par le relecteur.', status: A,
  },
  {
    id: 'hanbali-wudu-sunan', topic: 'wudu', school: 'hanbali', kind: 'list',
    title: { fr: 'Sunan', ar: 'سنن الوضوء' },
    items: ['Dire « Bismillah ».', 'Laver les mains au début.', 'Insister dans le rinçage de la bouche et du nez (sauf jeûneur).', 'Passer les doigts dans la barbe et entre les doigts.', 'Essuyer les oreilles.', 'Commencer par la droite.', 'Laver trois fois (au-delà : déconseillé, comme le gaspillage d’eau).', 'Le siwak (bouche altérée, réveil, prière).'],
    textAr: 'والمسنون التسمية وغسل الكفين والمبالغة في المضمضة والاستنشاق إلا أن يكون صائما وتخليل اللحية والأصابع ومسح الأذنين وغسل الميامن قبل المياسر والغسل ثلاثا ثلاثا وتكره الزيادة عليها والإسراف في الماء. ويسن السواك ...',
    source: src('umda', 'bāb al-wuḍū’', 'p. 16', 7), evidence: ['Siwak : al-Bukhārī 887, Muslim 252 (référence donnée par l’éditeur)'], status: A,
  },
  {
    id: 'hanbali-wudu-nawaqid', topic: 'wudu', school: 'hanbali', kind: 'list',
    title: { fr: 'Ce qui annule les ablutions (7)', ar: 'نواقض الوضوء' },
    items: ['Ce qui sort des deux voies.', 'Une impureté abondante sortant d’ailleurs.', 'La perte de la raison, sauf un sommeil léger assis ou debout.', 'Toucher le sexe avec la main.', 'Toucher une femme avec désir.', 'L’apostasie.', 'Manger de la viande de chameau.', 'Certitude de la pureté et doute du hadath (ou l’inverse) : on s’en tient à la certitude.'],
    textAr: 'هي سبعة: الخارج من السبيلين والخارج النجس من غيرهما إذا فحش وزوال العقل إلا النوم اليسير جالسا أو قائما ولمس الذكر بيده ولمس امرأة ... بشهوة والردة عن الإسلام وأكل لحم الإبل ... ومن تيقن الطهارة وشك في الحدث أو تيقن الحدث وشك في [في نسخة الشاملة: «ف»] الطهارة فهو على ما تيقن منهما.',
    source: src('umda', 'bāb nawāqiḍ al-wuḍū’', 'p. 16-17', 9),
    evidence: ['Viande de chameau : Muslim 360 (hadith de Jābir ibn Samura, référence donnée par l’éditeur)'], status: A,
  },
  {
    id: 'hanbali-ghusl', topic: 'ghusl', school: 'hanbali', kind: 'list',
    title: { fr: 'Causes et obligations', ar: 'موجب الغسل وواجبه' },
    items: ['Causes : émission de sperme (jaillissant) ; rencontre des deux parties circoncises.', 'Obligations : l’intention ; laver tout le corps, avec rinçage de la bouche et du nez.', 'Sunna : Bismillah, frotter le corps, suivre la description du bain du Prophète ﷺ rapportée par Maymuna.'],
    textAr: 'والموجب له: خروج المني وهو الماء الدافق والتقاء الختانين. والواجب فيه النية و[تعميم] بدنه بالغسل مع المضمضة والاستنشاق وتسن التسمية ويدلك بدنه بيديه ويفعل كما روت ميمونة ...',
    source: src('umda', 'bāb al-ghusl min al-janāba', 'p. 17', 11),
    evidence: ['Hadith de Maymūna : al-Bukhārī 281, Muslim 317 (référence donnée par l’éditeur)'],
    note: 'L’édition Shamela porte « والواجب فيه النية وبدنه » : un mot semble manquer (« تعميم » restitué entre crochets) — à vérifier sur l’imprimé. Règles et lochies sont traitées dans les bāb al-ḥayḍ / an-nifās (non résumés).', status: A,
  },
  {
    id: 'hanbali-tayammum', topic: 'tayammum', school: 'hanbali', kind: 'list',
    title: { fr: 'Description et 4 conditions', ar: 'صفة التيمم وشروطه' },
    items: ['Une seule frappe sur une terre pure, puis essuyer le visage et les mains (paumes).', 'Condition 1 : l’incapacité d’utiliser l’eau (absence, maladie, grand froid, soif, danger, prix excessif).', 'Condition 2 : l’heure (pas de tayammum pour une prière obligatoire avant son heure).', 'Condition 3 : l’intention.', 'Condition 4 : une terre pure qui a de la poussière.', 'Il est annulé par ce qui annule l’ablution, par la sortie de l’heure, et dès qu’on peut utiliser l’eau (même en prière).'],
    textAr: 'وصفته أن يضرب بيديه على الصعيد الطيب ضربة واحدة فيمسح بهما وجهه وكفيه ... وله شروط أربعة: أحدها: العجز عن استعمال الماء ... الثاني: الوقت ... الثالث: النية ... الرابع: التراب فلا يتيمم إلا بتراب طاهر له غبار ويبطل التيمم ما يبطل طهارة الماء وخروج الوقت والقدرة على استعمال الماء وإن كان في الصلاة.',
    source: src('umda', 'bāb at-tayammum', 'p. 17-18', 12),
    evidence: ['Hadith de ‘Ammār (« إنما يكفيك هكذا ») : al-Bukhārī 347, Muslim 368 (référence donnée par l’éditeur)'], status: A,
  },
  {
    id: 'hanbali-salat-shurut', topic: 'salat', school: 'hanbali', kind: 'list',
    title: { fr: 'Les 6 conditions', ar: 'شرائط الصلاة' },
    items: ['La pureté du hadath.', 'L’heure.', 'Couvrir la ‘awra.', 'La pureté de la najasa (corps, vêtement, lieu).', 'Se tourner vers la qibla.', 'L’intention.'],
    textAr: 'وهي ستة: الشرط الأول: الطهارة من الحدث ... الشرط الثاني: الوقت ... الشرط الثالث: ستر العورة ... الشرط الرابع: الطهارة من النجاسة في بدنه وثوبه وموضع صلاته ... الشرط الخامس: استقبال القبلة ... [الشرط السادس: النية]',
    source: src('umda', 'bāb sharā’iṭ aṣ-ṣalāt', 'p. 22-23', 19), status: A,
  },
  {
    id: 'hanbali-salat-arkan', topic: 'salat', school: 'hanbali', kind: 'list',
    title: { fr: 'Les 12 piliers (arkan)', ar: 'أركان الصلاة' },
    items: ['La station debout si on le peut.', 'Le takbir d’ouverture.', 'La Fatiha.', 'Le ruku‘ et le redressement.', 'Le sujud sur les sept membres et l’assise qui suit.', 'La sérénité dans ces piliers.', 'Le dernier tashahhud et la position assise pour lui.', 'Le premier salam.', 'L’ordre.'],
    textAr: 'أركانها اثنا عشر: القيام مع القدرة وتكبيرة الإحرام وقراءة الفاتحة والركوع والرفع منه والسجود على السبعة الأعضاء والجلوس عنه والطمأنينة في هذه الأركان والتشهد الأخير والجلوس له والتسليمة الأولى وترتيبها على ما ذكرناه.',
    source: src('umda', 'bāb arkān aṣ-ṣalāt wa wājibātihā', 'p. 26', 25), status: A,
  },
  {
    id: 'hanbali-salat-wajibat', topic: 'salat', school: 'hanbali', kind: 'list',
    title: { fr: 'Les 7 obligations wajib — oubli réparé par le sujud as-sahw', ar: 'واجبات الصلاة' },
    items: ['Les takbirs autres que celui d’ouverture.', 'Le tasbih du ruku‘ et du sujud, une fois.', '« Sami‘a Llahu li-man hamidah » et « Rabbana wa laka-l-hamd » au redressement.', '« Rabbi ghfir li » entre les deux prosternations.', 'Le premier tashahhud et la position assise pour lui.', 'La prière sur le Prophète ﷺ dans le dernier tashahhud.', 'Omis volontairement : la prière est nulle ; par oubli : sujud as-sahw. Le reste est sunna (pas de sujud obligatoire).'],
    textAr: 'وواجباتها سبعة التكبير غير تكبيرة الإحرام والتسبيح في الركوع والسجود مرة مرة والتسبيح والتحميد في الرفع من الركوع وقول ربي اغفر لي بين السجدتين والتشهد الأول والجلوس له والصلاة على النبي صلى الله عليه وسلم في التشهد الأخير فهذه إن تركها عمدا بطلت صلاته وإن تركها سهوا سجد لها وما عدا هذا فسنن لا تبطل الصلاة بعمدها ولا يجب السجود لسهوها.',
    source: src('umda', 'bāb arkān aṣ-ṣalāt wa wājibātihā', 'p. 26', 25), status: A,
  },
];

/** Ce qui n’a PAS été ajouté faute de source citable avec précision (à compléter par un relecteur). */
export const FIQH_GAPS: { school: School; topic: string; what: string }[] = [
  { school: 'hanafi', topic: 'ghusl', what: 'Causes du ghusl (mūjibāt) : passage de Nūr al-Īḍāḥ p. 27 non recopié — non affiché.' },
  { school: 'hanafi', topic: 'sahw', what: 'Pilier (rukn) oublié : non traité explicitement dans Nūr al-Īḍāḥ (bāb sujūd as-sahw) — non affiché.' },
  { school: 'hanafi', topic: 'sahw', what: 'Qunut du Subh : pas une pratique hanafite (le qunut wājib est celui du witr) — cas non affiché pour cette école.' },
  { school: 'hanbali', topic: 'sahw', what: 'Qunut du Subh : non mentionné dans ‘Umdat al-Fiqh — non affiché.' },
  { school: 'hanbali', topic: 'sahw', what: 'Récitation haute/basse : sunna selon ‘Umda p. 26 (pas de sujud obligatoire) — affiché tel quel ; le caractère facultatif du sujud pour une sunna n’est pas détaillé dans ‘Umda.' },
  { school: 'maliki', topic: 'général', what: 'Numérotation globale des vers du Murshid d’Ibn ‘Āshir : non obtenue (aucune édition numérotée accessible) — vers cités par page de Mayyāra.' },
  { school: 'maliki', topic: 'sahw', what: 'ar-Risāla p. 37 : le texte Shamela est lacunaire au début du passage sur le sahw — fragment cité, à vérifier sur l’imprimé.' },
  { school: 'hanafi', topic: 'général', what: 'Marāqī al-Falāḥ et Mukhtaṣar al-Qudūrī non utilisés comme source principale (Nūr al-Īḍāḥ suffit pour le périmètre) ; al-Qudūrī disponible pour recoupement.' },
  { school: 'hanbali', topic: 'général', what: 'Zād al-Mustaqni‘ et Akhṣar al-Mukhtaṣarāt non utilisés (‘Umdat al-Fiqh suffit pour le périmètre).' },
  { school: 'maliki', topic: 'tout', what: 'Résumés anglais et arabes : traduction Zikru, à relire (les extraits arabes des sources restent affichés tels quels).' },
];

export function rulingsFor(school: School, topic?: Topic): FiqhRuling[] {
  return RULINGS.filter((r) => r.school === school && (!topic || r.topic === topic));
}
export function citation(s: FiqhSource): string {
  return `${s.book} — ${s.chapter}, ${s.page}. ${s.edition}.`;
}
