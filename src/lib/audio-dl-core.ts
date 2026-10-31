/**
 * Téléchargements audio hors-ligne — comptabilité pure (testée par scripts/test-quran-pass3.mjs).
 * Unité : une sourate d’un récitateur. Les versets sont téléchargés dans l’ordre, donc une sourate partielle
 * contient les versets 1..v (reprise au verset v+1). Les tailles affichées avant téléchargement viennent des
 * en-têtes Content-Length (HEAD) ; après téléchargement, des octets réellement écrits.
 */
export type SurahDl = { /** versets présents (1..v) */ v: number; /** versets de la sourate */ total: number; bytes: number; at: number };
export type DlManifest = Record<string, Record<string, SurahDl>>;
/** Tailles mesurées (octets) par récitateur puis sourate. */
export type SizeTable = Record<string, Record<string, number>>;

const p3 = (n: number) => String(n).padStart(3, '0');
/** Nom de fichier EveryAyah d’un verset (SSSAAA.mp3). */
export const verseFile = (s: number, a: number) => `${p3(s)}${p3(a)}.mp3`;

export const entry = (m: DlManifest, rid: string, s: number): SurahDl | undefined => m[rid]?.[String(s)];
export const isComplete = (e: SurahDl | undefined) => !!e && e.v >= e.total;
/** Le verset (s, a) est-il sur l’appareil ? */
export const isLocal = (m: DlManifest, rid: string, s: number, a: number) => {
  const e = entry(m, rid, s);
  return !!e && a >= 1 && a <= e.v;
};

/** Enregistre un verset téléchargé (le suivant attendu) ; tout autre verset est ignoré (pas de double comptage). */
export function addVerse(m: DlManifest, rid: string, s: number, a: number, total: number, bytes: number, now: number): DlManifest {
  const e = entry(m, rid, s) ?? { v: 0, total, bytes: 0, at: now };
  if (a !== e.v + 1 || a > total) return m;
  return { ...m, [rid]: { ...(m[rid] ?? {}), [String(s)]: { v: a, total, bytes: e.bytes + Math.max(0, bytes), at: now } } };
}

export function removeSurah(m: DlManifest, rid: string, s: number): DlManifest {
  if (!entry(m, rid, s)) return m;
  const r = { ...(m[rid] ?? {}) };
  delete r[String(s)];
  const out = { ...m, [rid]: r };
  if (!Object.keys(r).length) delete out[rid];
  return out;
}
export function removeReciter(m: DlManifest, rid: string): DlManifest {
  if (!m[rid]) return m;
  const out = { ...m };
  delete out[rid];
  return out;
}

export const reciterBytes = (m: DlManifest, rid: string) => Object.values(m[rid] ?? {}).reduce((t, e) => t + e.bytes, 0);
export const totalBytes = (m: DlManifest) => Object.keys(m).reduce((t, r) => t + reciterBytes(m, r), 0);
export function reciterSummary(m: DlManifest, rid: string) {
  const list = Object.values(m[rid] ?? {});
  return { complete: list.filter(isComplete).length, partial: list.filter((e) => !isComplete(e)).length, bytes: reciterBytes(m, rid) };
}

/** Octets encore à télécharger pour une sourate, d’après la taille mesurée (null si non mesurée). */
export function remainingBytes(m: DlManifest, sizes: SizeTable, rid: string, s: number): number | null {
  const size = sizes[rid]?.[String(s)];
  if (size == null) return null;
  const e = entry(m, rid, s);
  if (isComplete(e)) return 0;
  return Math.max(0, size - (e?.bytes ?? 0));
}
/** Taille mesurée d’un ensemble de sourates : somme + nombre de sourates encore non mesurées. */
export function sizeOf(sizes: SizeTable, rid: string, surahs: number[]): { bytes: number; unknown: number } {
  let bytes = 0, unknown = 0;
  for (const s of surahs) {
    const v = sizes[rid]?.[String(s)];
    if (v == null) unknown++;
    else bytes += v;
  }
  return { bytes, unknown };
}

const UNITS: Record<string, string[]> = { fr: ['o', 'Ko', 'Mo', 'Go'], en: ['B', 'KB', 'MB', 'GB'], ar: ['بايت', 'ك.ب', 'م.ب', 'ج.ب'], de: ['B', 'KB', 'MB', 'GB'] };
/** Taille lisible (base 1000, comme iOS/Android) : « 1,2 Mo », « 1.2 MB », « 1٫2 م.ب ». */
export function formatBytes(n: number, lang = 'fr'): string {
  const u = UNITS[lang] ?? UNITS.en;
  let v = Math.max(0, n), i = 0;
  while (v >= 1000 && i < u.length - 1) {
    v /= 1000;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : 1;
  const loc = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : 'en-US';
  let txt: string;
  try {
    txt = v.toLocaleString(loc, { maximumFractionDigits: digits, minimumFractionDigits: digits, numberingSystem: 'latn' } as Intl.NumberFormatOptions);
  } catch {
    txt = v.toFixed(digits);
  }
  return `${txt} ${u[i]}`;
}

/** Exécute fn sur chaque élément avec au plus n tâches en parallèle (résultats dans l’ordre). */
export async function mapLimit<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>, stop?: () => boolean): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length && !stop?.()) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  return out;
}
