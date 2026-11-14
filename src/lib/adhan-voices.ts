/**
 * Voix d’adhan publiées. Aucune n’est synthétisée, aucune n’est un extrait du Coran.
 * Les fichiers complets sont lus par HTTPS (transcodage MP3 de Wikimedia, l’original
 * est souvent en Ogg, illisible sur iOS). Ils ne sont pas copiés dans l’application.
 *
 * Fichiers locaux (absents tant que Mohamed ne les dépose pas) : voir `LOCAL_ADHAN_SLOTS`
 * et `src/lib/audio.ts`. Un `require` vers un fichier manquant casse le bundle : laisser `null`.
 *
 * Le son de notification `adhan_cue.wav` est une conversion de la lecture de Jarih
 * (CC BY-SA 3.0, moins de 30 s). Ce n’est pas la voix choisie par l’utilisateur.
 */

export type AdhanSource = number | { uri: string };

export type AdhanVoice = {
  id: string;
  /** Titre affiché (français source, clé du catalogue d’interface). */
  title: string;
  /** Origine affichée (français source). */
  origin: string;
  /** Style ou lieu, quand la source le dit. Français source. */
  style: string;
  /** Nom publié du mu’adhdhin, de l’auteur ou de l’enregistreur. Vide si inconnu. */
  reciter: string;
  source: AdhanSource | null;
  pageUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  kind: 'published' | 'local' | 'custom';
};

/**
 * Licence refusée pour une application payante, ou null si elle peut être proposée.
 * NC, ND, droits réservés, licence absente ou inconnue. CC0, domaine public, CC BY et CC BY-SA passent.
 * ND est refusé même sans coupure : une extraction ou un transcodage est déjà une modification.
 */
export function licenseBlockReason(license: string | null | undefined): string | null {
  const s = (license ?? '').trim();
  if (!s) return 'licence absente';
  const l = s.toLowerCase();
  if (/\bnc\b|non[-\s]?commercial|noncommercial/.test(l)) return 'NC';
  if (/by-?nd|\bnd\b|no derivatives|pas de modification/.test(l)) return 'ND';
  if (/tous droits|all rights reserved|inconnue|unknown|synthèse|text-to-speech|\btts\b/.test(l)) return 'licence refusée';
  if (!/cc0|cc by|by-sa|public domain|domaine public/.test(l)) return 'licence non reconnue';
  return null;
}

export const DEFAULT_ADHAN_VOICE_ID = 'commons-adam-synagda';

/** Nom de fichier embarqué (plugin expo-notifications). Android n’accepte pas le trait d’union dans res/raw. */
export const ADHAN_CUE_SOUND = 'adhan_cue.wav';
/** Canal Android distinct : le son du canal s’applique à toutes les notifications de ce canal. */
export const ADHAN_CHANNEL_ID = 'prayers-adhan';

export const ADHAN_CUE = {
  reciter: 'Jarih',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Adhan_wiki.oga',
  sound: ADHAN_CUE_SOUND,
} as const;

const CC0 = 'CC0 1.0';
const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';
const BY_SA_4 = 'CC BY-SA 4.0';
const BY_SA_4_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
const BY_SA_3 = 'CC BY-SA 3.0';
const BY_SA_3_URL = 'https://creativecommons.org/licenses/by-sa/3.0/';

const PUBLISHED: Omit<AdhanVoice, 'source'>[] = [
  {
    id: 'commons-adam-synagda',
    title: 'Beautiful adhan — Adam-synagda',
    origin: 'Travail personnel publié sur Wikimedia Commons',
    style: 'Non rattaché à une ville',
    reciter: 'Adam-synagda',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg',
    license: CC0,
    licenseUrl: CC0_URL,
    kind: 'published',
  },
  {
    id: 'commons-andrewler',
    title: 'Azan — Andrewler',
    origin: 'Travail personnel publié sur Wikimedia Commons',
    style: 'Non rattaché à une ville',
    reciter: 'Andrewler',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Azan.ogg',
    license: BY_SA_4,
    licenseUrl: BY_SA_4_URL,
    kind: 'published',
  },
  {
    id: 'commons-aishatu98',
    title: 'Adhan — Aishatu98',
    origin: 'Annonce d’adhan, travail personnel publié sur Wikimedia Commons',
    style: 'Non rattaché à une ville',
    reciter: 'Aishatu98',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Adhan.ogg',
    license: CC0,
    licenseUrl: CC0_URL,
    kind: 'published',
  },
  {
    id: 'commons-jarih',
    title: 'Adhan — Jarih',
    origin: 'Lecture simple de l’adhan (version sunnite), travail personnel',
    style: 'Non rattaché à une ville',
    reciter: 'Jarih',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Adhan_wiki.oga',
    license: BY_SA_3,
    licenseUrl: BY_SA_3_URL,
    kind: 'published',
  },
  {
    id: 'commons-hassan-ii',
    title: 'Adhan, mosquée Hassan II',
    origin: 'Enregistrement de terrain à Casablanca, par Fraguando (mer, vent et voix alentour)',
    style: 'Maghreb',
    reciter: 'Fraguando',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav',
    license: BY_SA_4,
    licenseUrl: BY_SA_4_URL,
    kind: 'published',
  },
  {
    id: 'commons-ghana-ramadan',
    title: 'Adhan du Ramadan, Ghana',
    origin: 'Enregistrement de terrain au Ghana (Wiki Loves Ramadan 2026), par daSupremo',
    style: 'Afrique de l’Ouest',
    reciter: 'daSupremo',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Athan_in_Ramadan.wav',
    license: BY_SA_4,
    licenseUrl: BY_SA_4_URL,
    kind: 'published',
  },
  {
    id: 'commons-aaqib',
    title: 'Adhan — Aaqib Azeez',
    origin: 'Travail personnel publié par Atcovi sur Wikimedia Commons ; le titre du fichier nomme Aaqib Azeez',
    style: 'Non rattaché à une ville',
    reciter: 'Aaqib Azeez',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
    license: BY_SA_4,
    licenseUrl: BY_SA_4_URL,
    kind: 'published',
  },
];

const PUBLISHED_URI: Record<string, string> = {
  'commons-adam-synagda': 'https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b0/Beautiful_adhan.ogg/Beautiful_adhan.ogg.mp3',
  'commons-andrewler': 'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/86/Azan.ogg/Azan.ogg.mp3',
  'commons-aishatu98': 'https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e7/Adhan.ogg/Adhan.ogg.mp3',
  'commons-jarih': 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/16/Adhan_wiki.oga/Adhan_wiki.oga.mp3',
  'commons-hassan-ii': 'https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9c/Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav/Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav.mp3',
  'commons-ghana-ramadan': 'https://upload.wikimedia.org/wikipedia/commons/transcoded/6/64/Athan_in_Ramadan.wav/Athan_in_Ramadan.wav.mp3',
  'commons-aaqib': 'https://upload.wikimedia.org/wikipedia/commons/7/7d/The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
};

/**
 * Emplacements prévus pour les fichiers de Mohamed. Tant que `audio.ts` passe `null`,
 * la voix n’apparaît pas. Noms exacts dans assets/audio/ :
 *   bilal.mp3
 *   adhan-makkah.mp3
 *   adhan-madinah.mp3
 */
export const LOCAL_ADHAN_SLOTS: { id: string; filename: string; title: string; origin: string; style: string; reciter: string; pageUrl: string | null; license: string | null; licenseUrl: string | null }[] = [
  { id: 'local-bilal', filename: 'bilal.mp3', title: 'Bilal (fichier local)', origin: 'Fichier assets/audio/bilal.mp3', style: 'Non rattaché à une ville', reciter: '', pageUrl: null, license: null, licenseUrl: null },
  {
    id: 'local-makkah',
    filename: 'adhan-makkah.mp3',
    title: 'Adhan de La Mecque',
    origin: 'Piste audio extraite de la vidéo, sans autre traitement : Seyfula Islam, Grande Mosquée de La Mecque, 21 janvier 2013',
    style: 'La Mecque',
    reciter: 'Seyfula Islam',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Adhan,_Great_Mosque_of_Mecca_-_Jan_21,_2013.webm',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  { id: 'local-madinah', filename: 'adhan-madinah.mp3', title: 'Adhan de Médine (fichier local)', origin: 'Fichier assets/audio/adhan-madinah.mp3', style: 'Médine', reciter: '', pageUrl: null, license: null, licenseUrl: null },
  {
    id: 'local-konya',
    filename: 'adhan-konya.mp3',
    title: 'Adhan de Konya',
    origin: 'Piste audio extraite de la vidéo, sans autre traitement : Frans van der Vaart, Konya',
    style: 'Turquie',
    reciter: 'Frans van der Vaart',
    pageUrl: 'https://commons.wikimedia.org/wiki/File:Hminsec150_Konya.webm',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
];

function publishedVoices(): AdhanVoice[] {
  return PUBLISHED.map((v) => ({ ...v, source: { uri: PUBLISHED_URI[v.id] } }));
}

/**
 * Voix proposées. Les fichiers locaux présents passent en tête. L’URL personnelle
 * n’est ajoutée que si elle est renseignée (déjà filtrée : vide ou `YOUR_*` → null).
 */
export function assembleAdhanVoices(local: Record<string, number | null>, customUrl: string | null): AdhanVoice[] {
  const locals: AdhanVoice[] = [];
  for (const slot of LOCAL_ADHAN_SLOTS) {
    const file = local[slot.id];
    if (file == null) continue;
    locals.push({
      id: slot.id,
      title: slot.title,
      origin: slot.origin,
      style: slot.style,
      reciter: slot.reciter,
      source: file,
      pageUrl: slot.pageUrl,
      license: slot.license,
      licenseUrl: slot.licenseUrl,
      kind: 'local',
    });
  }
  const out: AdhanVoice[] = [...locals, ...publishedVoices()];
  const url = (customUrl ?? '').trim();
  if (url && !url.startsWith('YOUR_')) {
    out.push({
      id: 'custom-url',
      title: 'Lien audio personnel',
      origin: 'Adresse indiquée par EXPO_PUBLIC_ADHAN_AUDIO_URL (droits à votre charge)',
      style: 'Non rattaché à une ville',
      reciter: '',
      source: { uri: url },
      pageUrl: null,
      license: null,
      licenseUrl: null,
      kind: 'custom',
    });
  }
  return out;
}

export function resolveAdhanVoice(id: string | undefined, voices: AdhanVoice[]): AdhanVoice {
  const found = id ? voices.find((v) => v.id === id) : undefined;
  if (found) return found;
  const fallback = voices.find((v) => v.id === DEFAULT_ADHAN_VOICE_ID && v.source) ?? voices.find((v) => v.source);
  if (fallback) return fallback;
  return {
    id: 'none',
    title: 'Voix de l’adhan',
    origin: '',
    style: '',
    reciter: '',
    source: null,
    pageUrl: null,
    license: null,
    licenseUrl: null,
    kind: 'published',
  };
}

/** Chaînes françaises des voix (y compris les emplacements locaux encore vides). */
export function adhanUiStrings(): string[] {
  const voices = assembleAdhanVoices(
    Object.fromEntries(LOCAL_ADHAN_SLOTS.map((s) => [s.id, 1])),
    'https://example.com/adhan.mp3',
  );
  return [...new Set(voices.flatMap((v) => [v.title, v.origin, v.style].filter((s) => s)))];
}

export function payloadPlaysAdhan(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const v = (data as { playsAdhan?: unknown }).playsAdhan;
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** Réponse de notification trop ancienne pour relancer l’adhan à un simple démarrage. */
export function adhanResponseIsFresh(date: number | undefined, now = Date.now()): boolean {
  if (date == null || !Number.isFinite(date)) return false;
  const ms = date < 1e12 ? date * 1000 : date;
  const age = now - ms;
  return age >= 0 && age < 3 * 60 * 1000;
}
