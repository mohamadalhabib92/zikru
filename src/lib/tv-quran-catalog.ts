/**
 * Catalogue des sourates pour l’Apple TV.
 * Pas de SQLite, pas de fichier, pas de réseau : les 114 noms sont dans le JavaScript.
 * Si le tableau embarqué est illisible, la liste de secours (mêmes noms, copiés ici) s’affiche.
 */
import { SURAHS, type SurahMeta } from './surahs';

export const TV_SURAH_PAGE = 8;
export const TV_SURAH_ROW = 72;
export const TV_SURAH_BG = '#1A2420';
export const TV_SURAH_INK = '#F4F1EA';

export type TvSurahName = { n: number; name: string };

/** Copie autonome. Ne lit pas SURAHS : elle reste là si ce tableau est vide ou cassé. */
export const TV_SURAH_FALLBACK: readonly TvSurahName[] = [
  { n: 1, name: "Al-Faatiha" },
  { n: 2, name: "Al-Baqara" },
  { n: 3, name: "Aal-i-Imraan" },
  { n: 4, name: "An-Nisaa" },
  { n: 5, name: "Al-Maaida" },
  { n: 6, name: "Al-An'aam" },
  { n: 7, name: "Al-A'raaf" },
  { n: 8, name: "Al-Anfaal" },
  { n: 9, name: "At-Tawba" },
  { n: 10, name: "Yunus" },
  { n: 11, name: "Hud" },
  { n: 12, name: "Yusuf" },
  { n: 13, name: "Ar-Ra'd" },
  { n: 14, name: "Ibrahim" },
  { n: 15, name: "Al-Hijr" },
  { n: 16, name: "An-Nahl" },
  { n: 17, name: "Al-Israa" },
  { n: 18, name: "Al-Kahf" },
  { n: 19, name: "Maryam" },
  { n: 20, name: "Taa-Haa" },
  { n: 21, name: "Al-Anbiyaa" },
  { n: 22, name: "Al-Hajj" },
  { n: 23, name: "Al-Muminoon" },
  { n: 24, name: "An-Noor" },
  { n: 25, name: "Al-Furqaan" },
  { n: 26, name: "Ash-Shu'araa" },
  { n: 27, name: "An-Naml" },
  { n: 28, name: "Al-Qasas" },
  { n: 29, name: "Al-Ankaboot" },
  { n: 30, name: "Ar-Room" },
  { n: 31, name: "Luqman" },
  { n: 32, name: "As-Sajda" },
  { n: 33, name: "Al-Ahzaab" },
  { n: 34, name: "Saba" },
  { n: 35, name: "Faatir" },
  { n: 36, name: "Yaseen" },
  { n: 37, name: "As-Saaffaat" },
  { n: 38, name: "Saad" },
  { n: 39, name: "Az-Zumar" },
  { n: 40, name: "Ghafir" },
  { n: 41, name: "Fussilat" },
  { n: 42, name: "Ash-Shura" },
  { n: 43, name: "Az-Zukhruf" },
  { n: 44, name: "Ad-Dukhaan" },
  { n: 45, name: "Al-Jaathiya" },
  { n: 46, name: "Al-Ahqaf" },
  { n: 47, name: "Muhammad" },
  { n: 48, name: "Al-Fath" },
  { n: 49, name: "Al-Hujuraat" },
  { n: 50, name: "Qaaf" },
  { n: 51, name: "Adh-Dhaariyat" },
  { n: 52, name: "At-Tur" },
  { n: 53, name: "An-Najm" },
  { n: 54, name: "Al-Qamar" },
  { n: 55, name: "Ar-Rahmaan" },
  { n: 56, name: "Al-Waaqia" },
  { n: 57, name: "Al-Hadid" },
  { n: 58, name: "Al-Mujaadila" },
  { n: 59, name: "Al-Hashr" },
  { n: 60, name: "Al-Mumtahana" },
  { n: 61, name: "As-Saff" },
  { n: 62, name: "Al-Jumu'a" },
  { n: 63, name: "Al-Munaafiqoon" },
  { n: 64, name: "At-Taghaabun" },
  { n: 65, name: "At-Talaaq" },
  { n: 66, name: "At-Tahrim" },
  { n: 67, name: "Al-Mulk" },
  { n: 68, name: "Al-Qalam" },
  { n: 69, name: "Al-Haaqqa" },
  { n: 70, name: "Al-Ma'aarij" },
  { n: 71, name: "Nooh" },
  { n: 72, name: "Al-Jinn" },
  { n: 73, name: "Al-Muzzammil" },
  { n: 74, name: "Al-Muddaththir" },
  { n: 75, name: "Al-Qiyaama" },
  { n: 76, name: "Al-Insaan" },
  { n: 77, name: "Al-Mursalaat" },
  { n: 78, name: "An-Naba" },
  { n: 79, name: "An-Naazi'aat" },
  { n: 80, name: "Abasa" },
  { n: 81, name: "At-Takwir" },
  { n: 82, name: "Al-Infitaar" },
  { n: 83, name: "Al-Mutaffifin" },
  { n: 84, name: "Al-Inshiqaaq" },
  { n: 85, name: "Al-Burooj" },
  { n: 86, name: "At-Taariq" },
  { n: 87, name: "Al-A'laa" },
  { n: 88, name: "Al-Ghaashiya" },
  { n: 89, name: "Al-Fajr" },
  { n: 90, name: "Al-Balad" },
  { n: 91, name: "Ash-Shams" },
  { n: 92, name: "Al-Lail" },
  { n: 93, name: "Ad-Dhuhaa" },
  { n: 94, name: "Ash-Sharh" },
  { n: 95, name: "At-Tin" },
  { n: 96, name: "Al-Alaq" },
  { n: 97, name: "Al-Qadr" },
  { n: 98, name: "Al-Bayyina" },
  { n: 99, name: "Az-Zalzala" },
  { n: 100, name: "Al-Aadiyaat" },
  { n: 101, name: "Al-Qaari'a" },
  { n: 102, name: "At-Takaathur" },
  { n: 103, name: "Al-Asr" },
  { n: 104, name: "Al-Humaza" },
  { n: 105, name: "Al-Fil" },
  { n: 106, name: "Quraish" },
  { n: 107, name: "Al-Maa'un" },
  { n: 108, name: "Al-Kawthar" },
  { n: 109, name: "Al-Kaafiroon" },
  { n: 110, name: "An-Nasr" },
  { n: 111, name: "Al-Masad" },
  { n: 112, name: "Al-Ikhlaas" },
  { n: 113, name: "Al-Falaq" },
  { n: 114, name: "An-Naas" },
];

export type TvSurahCatalog = {
  status: 'ready' | 'error';
  source: 'embedded' | 'fallback';
  surahs: TvSurahName[];
  message: string;
};

function fromMeta(rows: readonly SurahMeta[]): TvSurahName[] {
  return rows.map((s) => ({ n: s[0], name: String(s[2] || '').trim() }));
}

function usable(rows: readonly TvSurahName[]): boolean {
  if (rows.length !== 114) return false;
  const seen = new Set<number>();
  for (const s of rows) {
    if (!s.name || s.n < 1 || s.n > 114 || seen.has(s.n)) return false;
    seen.add(s.n);
  }
  return seen.size === 114;
}

/**
 * Lecture synchrone. `embedded` permet au test de simuler un échec.
 * Sans argument, on lit le tableau déjà dans l’application.
 */
export function loadTvSurahCatalog(embedded?: readonly SurahMeta[] | null): TvSurahCatalog {
  try {
    const rows = embedded === undefined ? SURAHS : embedded;
    if (!rows) throw new Error('catalogue absent');
    const surahs = fromMeta(rows);
    if (!usable(surahs)) throw new Error('catalogue incomplet');
    return { status: 'ready', source: 'embedded', surahs, message: '' };
  } catch {
    return {
      status: 'error',
      source: 'fallback',
      surahs: TV_SURAH_FALLBACK.map((s) => ({ n: s.n, name: s.name })),
      message: 'Le catalogue des sourates n’a pas pu être lu. La liste de secours est affichée.',
    };
  }
}

export type TvSurahPaint = {
  n: number;
  label: string;
  height: number;
  backgroundColor: string;
  color: string;
  preferred: boolean;
};

/** Une page, jamais une liste virtualisée. Hauteur et couleurs sont des nombres, pas un flex. */
export function paintTvSurahPage(surahs: readonly TvSurahName[], page: number, pageSize = TV_SURAH_PAGE): { page: number; pages: number; rows: TvSurahPaint[] } {
  const size = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(surahs.length / size));
  const p = Math.max(0, Math.min(Math.floor(page) || 0, pages - 1));
  const slice = surahs.slice(p * size, p * size + size);
  return {
    page: p,
    pages,
    rows: slice.map((s, i) => ({
      n: s.n,
      label: s.n + '. ' + s.name,
      height: TV_SURAH_ROW,
      backgroundColor: TV_SURAH_BG,
      color: TV_SURAH_INK,
      preferred: i === 0,
    })),
  };
}
