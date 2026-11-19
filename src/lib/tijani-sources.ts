/**
 * Sources consultées pour les formules et les nombres du wird tijani.
 * Les textes arabes déjà dans `tijani.ts` ne sont pas réécrits : là où les pages
 * publiées divergent, la divergence est notée et l’entrée reste « à vérifier ».
 * Les traductions françaises de l’app sont les siennes (indicatives), pas une copie
 * d’une traduction éditée.
 */

export type CitedSource = { title: string; ref: string; note: string };

export const A_VERIFIER = 'à vérifier' as const;

const FIQH = 'https://tidjaniya.com/en/tariqa-fiqh/';
const FATIH_PAGE = 'https://tidjaniyyah.net/la-salat-al-fatih/';
const WIKI_FATIH = 'https://en.wikipedia.org/wiki/Salat_al-Fatih';
const JAWHARA_PRAY = 'https://pray.islamic.network/salawaats/jawharat-al-kamal';
const JAWHARA_SALAWAT = 'https://salawat.com/ar/%D8%AC%D9%88%D9%87%D8%B1%D8%A9-%D8%A7%D9%84%D9%83%D9%85%D8%A7%D9%84/';
const JAWHARA_ARCHIVE = 'https://archive.org/details/jawharatul_kamal_20210228';
const JAWHARA_SAADA = 'https://www.ibnalarabi.com/books/saadat.php?id=60';
const LITANIES = 'https://www.tidjania.ma/download/3523/';

export const SOURCES = {
  fatiha: [
    {
      title: 'Al-Fatiha, texte uthmani Tanzil',
      ref: 'src/lib/quran-uthmani.ts (contrôlé par scripts/test-fatiha.mjs)',
      note: 'Texte coranique déjà dans l’app. La traduction anglaise est celle de M. Pickthall (1930, domaine public). La traduction française est rédigée pour l’app.',
    },
  ] satisfies CitedSource[],
  istighfar: [
    {
      title: 'Tariqa Tidjaniya Fiqh — The Lazim',
      ref: FIQH,
      note: 'Premier pilier du Lazim : 100 fois « Astaghfirullah ». Graphie vocalisée usuelle أَسْتَغْفِرُ اللَّهَ, vocabulaire coranique. L’imprimé de Jawahir al-ma‘ani n’a pas été collationné.',
    },
  ] satisfies CitedSource[],
  istighfarWazifa: [
    {
      title: 'Tariqa Tidjaniya Fiqh — The Wadhifa',
      ref: FIQH,
      note: '30 fois « Astaghfirullah Al ‘Adhim aladhi la ilaha illa Houwa-l-Hayyou-l-Qayyoum ». La vocalisation de l’app met الْحَيَّ الْقَيُّومَ à l’accusatif.',
    },
    {
      title: 'Litanies of the Tijani Tariqah (fiche publiée)',
      ref: LITANIES,
      note: 'Même formule et le même nombre (30). TODO : certaines graphies impriment الْحَيُّ الْقَيُّومُ au nominatif. Non tranché ici.',
    },
  ] satisfies CitedSource[],
  fatih: [
    {
      title: 'Salât al-Fâtih (tidjaniyyah.net)',
      ref: FATIH_PAGE,
      note: 'Texte arabe de l’app aligné sur cette page : مُحَمَّدٍ (tanwīn) et وَالْهَادِي. Nombre : 100 dans le Lazim, 50 dans la Wazifa (tidjaniya.com).',
    },
    {
      title: 'Wikipedia, Salat al-Fatih (citation « Tariqa Tijaniyya »)',
      ref: WIKI_FATIH,
      note: 'TODO : cette page imprime مُحَمَّدِ (kasra, sans tanwīn) et الْهَادِي sans waw. L’arabe de l’app n’a pas été modifié pour coller à l’une ou l’autre.',
    },
  ] satisfies CitedSource[],
  hailala: [
    {
      title: 'Formule coranique lā ilāha illā-llāh',
      ref: 'Coran 37:35 et 47:19 (sens) ; texte court usuel',
      note: 'لَا إِلَهَ إِلَّا اللَّهُ. Lazim et Wazifa : 100 fois (tidjaniya.com). Haylala du vendredi : voir les sources du nombre, qui divergent.',
    },
    {
      title: 'Tariqa Tidjaniya Fiqh — The Haylala',
      ref: FIQH,
      note: 'Vendredi, entre ‘Asr et Maghrib. Cette page donne 1000, 1200 ou 1600, puis la clôture.',
    },
    {
      title: 'Litanies of the Tijani Tariqah — Friday Dhikr',
      ref: LITANIES,
      note: 'TODO : cette fiche dit qu’il n’y a pas de nombre fixé (une heure ou plus, jusqu’au coucher), et 1000 à 1600 seulement si l’on ne peut pas rester assis. L’app ne choisit donc pas un total : le compteur affiche le nombre dit, sans le déclarer obligatoire.',
    },
  ] satisfies CitedSource[],
  closing: [
    {
      title: 'Tariqa Tidjaniya Fiqh — clôture du centième tahlil',
      ref: FIQH,
      note: 'Après le centième « La ilaha illallah » du Lazim : « Muhammadun Rasulullah. ‘alayhi Salamullah ». La Haylala de la même page ajoute « Seyyiduna ». L’arabe de l’app contient سَيِّدُنَا. TODO : ne pas unifier les deux formules sans l’imprimé.',
    },
  ] satisfies CitedSource[],
  jawhara: [
    {
      title: 'Jawharat al-Kamal (pray.islamic.network et salawat.com)',
      ref: `${JAWHARA_PRAY} · ${JAWHARA_SALAWAT}`,
      note: 'Même enchaînement que l’arabe de l’app (عين الرحمة… صراطك التام الأسقم… صلاة تعرفنا بها إياه). Nombre publié : 12 dans la Wazifa (tidjaniya.com et la fiche tidjania.ma). Si la pureté par l’eau manque : 20 Salat al-Fatih à la place, selon ces mêmes pages.',
    },
    {
      title: 'Archive.org, transcription d’une copie calligraphiée',
      ref: JAWHARA_ARCHIVE,
      note: 'TODO : الْحَائِطِ (kasra) sur cette transcription, الْحَائِطَ (fatha) dans l’app. Non modifié.',
    },
    {
      title: 'Sa‘adat haqa’iq (citation de Jawahir al-ma‘ani)',
      ref: JAWHARA_SAADA,
      note: 'TODO : cette page donne عَيْنِ الْمَعَارِفِ الْأَقْدَمِ et صِرَاطِكَ التَّامِّ الْأَقْوَمِ, et الْأَرْيَاح plutôt que الْأَرْبَاح. L’app garde الْأَقْوَمِ / الْأَسْقَمِ / الْأَرْبَاح, lecture aussi imprimée par pray.islamic.network. À collationner sur Jawahir al-ma‘ani.',
    },
  ] satisfies CitedSource[],
} as const;

export const COUNT_TODOS = {
  jawharaEleven:
    'TODO : ×11 est signalé pour relecture. Les pages consultées (tidjaniya.com, fiche tidjania.ma) impriment 12, pas 11. Le nombre reste 12 tant que l’imprimé n’a pas été revu.',
  haylalaNumbers:
    'TODO : tidjaniya.com donne 1000, 1200 ou 1600 ; la fiche tidjania.ma dit qu’il n’y a pas de nombre fixé jusqu’au Maghrib. Aucun de ces totaux n’est enregistré comme obligatoire.',
  fatihaOrder:
    'TODO : tidjaniya.com n’ouvre pas le Lazim, la Wazifa ni la Haylala par Al-Fatiha. L’étape 1× déjà présente dans l’app est conservée (les coches enregistrées en dépendent) et reste à faire valider par un muqaddam.',
  lazimNoJawhara:
    'Le Lazim publié (tidjaniya.com) a trois piliers : istighfar, salat ‘ala-n-nabi, tahlil. Jawharat al-Kamal est un pilier de la Wazifa, pas du Lazim. Elle n’a pas été ajoutée au Lazim.',
} as const;
