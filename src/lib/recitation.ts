/**
 * Récitations verset par verset (module pur) : diffusées depuis des CDN publics, rien n’est embarqué dans l’app.
 * - EveryAyah.com (fichiers SSSAAA.mp3) — https://everyayah.com
 * - Secours : cdn.islamic.network (Islamic Network / alquran.cloud), numérotation globale 1..6236.
 */
import { OFFSETS } from './quran-nav';
import { SURAHS } from './surahs';

export type Reciter = { id: string; name: string; style: string; folder: string; riwaya: 'Hafs' | 'Warsh'; fallback?: string };
export const RECITERS: Reciter[] = [
  { id: 'alafasy', name: 'Mishary Rashid Alafasy', style: 'Murattal', folder: 'Alafasy_128kbps', riwaya: 'Hafs', fallback: '128/ar.alafasy' },
  { id: 'husary', name: 'Mahmoud Khalil al-Husary', style: 'Murattal', folder: 'Husary_128kbps', riwaya: 'Hafs', fallback: '128/ar.husary' },
  { id: 'husary-muallim', name: 'Al-Husary (Mu‘allim)', style: 'Enseignement · idéal pour mémoriser', folder: 'Husary_Muallim_128kbps', riwaya: 'Hafs' },
  { id: 'minshawi', name: 'Muhammad Siddiq al-Minshawi', style: 'Murattal', folder: 'Minshawy_Murattal_128kbps', riwaya: 'Hafs', fallback: '128/ar.minshawi' },
  { id: 'abdulbasit', name: 'Abdul Basit Abdus-Samad', style: 'Murattal', folder: 'Abdul_Basit_Murattal_192kbps', riwaya: 'Hafs', fallback: '192/ar.abdulbasitmurattal' },
  { id: 'warsh-dosary', name: 'Ibrahim al-Dosary', style: 'Warsh ‘an Nafi‘', folder: 'warsh/warsh_ibrahim_aldosary_128kbps', riwaya: 'Warsh' },
  { id: 'warsh-jazaery', name: 'Yassin al-Jaza’iri', style: 'Warsh ‘an Nafi‘', folder: 'warsh/warsh_yassin_al_jazaery_64kbps', riwaya: 'Warsh' },
];
export const reciterById = (id: string) => RECITERS.find((r) => r.id === id) ?? RECITERS[0];

const p3 = (n: number) => String(n).padStart(3, '0');
/** URL du verset (s, a) pour un récitateur. */
export const ayahUrl = (r: Reciter, s: number, a: number) => `https://everyayah.com/data/${r.folder}/${p3(s)}${p3(a)}.mp3`;
/** URL de secours (Islamic Network), si le récitateur y est disponible. */
export const ayahFallbackUrl = (r: Reciter, s: number, a: number) => (r.fallback ? `https://cdn.islamic.network/quran/audio/${r.fallback}/${OFFSETS[s - 1] + a}.mp3` : null);

export type Step = { s: number; a: number; /** répétition du verset (1..n) */ rep: number; /** passage de la plage (1..m) */ pass: number };
/**
 * File de lecture : chaque verset répété `each` fois, la plage entière `times` fois (0 = en boucle, la file est alors
 * reconstruite à la fin). `verses` est la liste ordonnée [sourate, verset].
 */
export function buildQueue(verses: [number, number][], each = 1, times = 1): Step[] {
  const out: Step[] = [];
  const n = Math.max(1, each), m = Math.max(1, times);
  for (let pass = 1; pass <= m; pass++) for (const [s, a] of verses) for (let rep = 1; rep <= n; rep++) out.push({ s, a, rep, pass });
  return out;
}

/** Pause après le récitateur : secondes fixes, ou multiple de la durée du verset (pour répéter à voix haute). */
export type Gap = 0 | 2 | 5 | 'x1' | 'x1.5';
export const gapMs = (g: Gap, durationSec: number) => (g === 'x1' ? durationSec * 1000 : g === 'x1.5' ? durationSec * 1500 : g * 1000);

/** Nombre de versets de la sourate s (0 si hors limites). */
export const ayahCount = (s: number) => SURAHS[s - 1]?.[4] ?? 0;

/** Bornes A-B remises dans l’ordre et dans la sourate (A ≤ B, 1 ≤ A, B ≤ nombre de versets). */
export function abRange(s: number, a: number, b: number): { s: number; a: number; b: number } {
  const n = ayahCount(s);
  if (!n) return { s: 1, a: 1, b: 1 };
  const c = (x: number) => Math.min(n, Math.max(1, Math.round(x) || 1));
  const x = c(a), y = c(b);
  return { s, a: Math.min(x, y), b: Math.max(x, y) };
}

/**
 * Répétition A-B : versets A..B de la sourate s, chacun `each` fois, la plage `times` fois.
 * `times` = 0 → en boucle (une seule passe dans la file, `loop` vrai : la file reprend au début à la fin).
 */
export function abQueue(s: number, a: number, b: number, times: number, each = 1): { queue: Step[]; loop: boolean; range: { s: number; a: number; b: number } } {
  const range = abRange(s, a, b);
  const verses: [number, number][] = [];
  for (let k = range.a; k <= range.b; k++) verses.push([range.s, k]);
  const loop = times <= 0;
  const m = loop ? 1 : Math.min(99, Math.round(times));
  return { queue: buildQueue(verses, Math.min(20, Math.max(1, Math.round(each))), m), loop, range };
}
export const AB_TIMES = [1, 3, 5, 7, 10, 0] as const;

/**
 * Lecture continue d’une sourate à l’autre : si la file vient de finir sur le dernier verset d’une sourate,
 * renvoie la file de la sourate suivante (versets 1..n) ; sinon null (fin de lecture normale).
 */
export function nextSurahQueue(last: Step | undefined): Step[] | null {
  if (!last || last.s >= 114 || last.a !== ayahCount(last.s)) return null;
  const s = last.s + 1;
  return buildQueue(Array.from({ length: ayahCount(s) }, (_, i) => [s, i + 1] as [number, number]));
}
