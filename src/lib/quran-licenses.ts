/**
 * Éditions du sens du Coran. Le texte n’est jamais réécrit ici.
 * Statut `verified` seulement pour Pickthall (domaine public). Tout QuranEnc reste `todo`
 * tant que la republication n’est pas confirmée par écrit — ne pas remplir YOUR_*.
 *
 * Versions lues sur l’API QuranEnc `GET /api/v1/translations/list` le 2026-11-05,
 * sauf `italian_rwwad` : absent de cette liste, présent sur le catalogue public
 * (V1.0.2, 29/08/2022) et sur `GET /api/v1/translation/sura/italian_rwwad/1`.
 */
export type LicenseStatus = 'verified' | 'todo';
export type EditionChannel = 'alquran' | 'quranenc';

export type QuranEdition = {
  /** Identifiant de cache / requête. `qe:` = QuranEnc, sinon alquran.cloud. */
  id: string;
  /** Libellé court (bouton, puce). */
  label: string;
  /** Citation affichée sous le verset : traducteur + ouvrage + identifiant + version. */
  citation: string;
  channel: EditionChannel;
  /** Clé QuranEnc, sans le préfixe `qe:`. */
  quranEncKey?: string;
  version?: string;
  status: LicenseStatus;
  /** Note d’édition (dialecte, etc.). Pas un sens religieux. */
  note?: string;
};

const qe = (key: string, version: string, label: string, work: string, note?: string): QuranEdition => ({
  id: `qe:${key}`,
  label,
  citation: `trad. ${label} · ${work} · QuranEnc ${key} v${version}`,
  channel: 'quranenc',
  quranEncKey: key,
  version,
  status: 'todo',
  note,
});

export const HAMIDULLAH: QuranEdition = {
  id: 'fr.hamidullah',
  label: 'Muhammad Hamidullah (FR)',
  citation: 'trad. Muhammad Hamidullah · alquran.cloud fr.hamidullah',
  channel: 'alquran',
  status: 'todo',
};

export const PICKTHALL: QuranEdition = {
  id: 'en.pickthall',
  label: 'M. Pickthall (EN, public domain)',
  citation: 'transl. M. Pickthall (1930, public domain) · alquran.cloud en.pickthall',
  channel: 'alquran',
  status: 'verified',
};

export const MUYASSAR: QuranEdition = {
  id: 'ar.muyassar',
  label: 'التفسير الميسر (مجمع الملك فهد)',
  citation: 'التفسير الميسر (مجمع الملك فهد) · alquran.cloud ar.muyassar',
  channel: 'alquran',
  status: 'todo',
};

/** Éditions QuranEnc câblées. Le wolof n’en a pas : ne pas inventer, ne pas utiliser Al-Islam. */
export const QURANENC: Record<string, QuranEdition> = {
  de: qe('german_bubenheim', '1.1.5', 'Bubenheim & Elyas', 'Der edle Qur’an'),
  'de-CH': qe('german_bubenheim', '1.1.5', 'Bubenheim & Elyas', 'Der edle Qur’an'),
  ff: qe(
    'fulani_rwwad',
    '1.0.2',
    'Rowwad (Fulani)',
    'Fulani Translation — Rowwad Translation Center',
    'QuranEnc dit « Fulani » (fulani_rwwad), pas « pulaar » au sens étroit. À faire confirmer par Mohamed pour son pulaar. Le texte n’est pas réécrit.',
  ),
  tr: qe('turkish_shahin', '1.0.0', 'Ali Özek et al.', 'Turkish Translation — Dr. Ali Ozek and others'),
  ur: qe('urdu_junagarhi', '1.1.3', 'Muhammad Junagarhi', 'Urdu Translation — Muhammad Junagarhi'),
  id: qe('indonesian_affairs', '1.0.1', 'Kemenag', 'Indonesian Ministry of Religious Affairs'),
  fa: qe('persian_ih', '1.1.3', 'Rowwad (persan)', 'Persian Translation — Rowwad Translation Center'),
  ha: qe(
    'hausa_gummi',
    '1.2.2',
    'Abu Bakr Mahmoud Jumi',
    'Hausa Translation — Abu Bakr Jumi',
    'Slug QuranEnc vérifié : hausa_gummi (deux m), v1.2.2. Pas hausa_gumi.',
  ),
  sw: qe('swahili_barawani', '1.0.1', 'Ali Muhsin Al-Barwani', 'Swahili Translation — Ali Mohsin Al-Barwani'),
  es: qe('spanish_garcia', '1.0.2', 'Muhammad Isa García', 'Spanish Translation — Isa Garcia'),
  it: qe(
    'italian_rwwad',
    '1.0.2',
    'Rowwad (italien)',
    'Italian Translation — Rowwad Translation Center',
    'Version 1.0.2 lue sur le catalogue public QuranEnc (29/08/2022). Absente de /translations/list ce jour-là ; l’endpoint sourate répond.',
  ),
  pt: qe('portuguese_nasr', '1.4.1', 'Helmi Nasr', 'Portuguese Translation — Helmi Nasr'),
};

export function editionFor(lang: string): QuranEdition {
  if (QURANENC[lang]) return QURANENC[lang];
  if (lang === 'en') return PICKTHALL;
  if (lang === 'ar') return MUYASSAR;
  // fr, wo, et toute langue sans édition citée : Hamidullah. Pas de wolof inventé.
  return HAMIDULLAH;
}

export function isQuranEncId(id: string): boolean {
  return id.startsWith('qe:');
}

export function quranEncKeyOf(id: string): string {
  return id.slice(3);
}
