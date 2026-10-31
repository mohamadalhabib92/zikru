/**
 * Programmes importés : rapprochement de chaque étape avec le Coran (index Tanzil, lib/quran-match) et avec le
 * catalogue sourcé de l’app (salawat, du‘as, formules, Noms). Comparaison EXACTE uniquement (après normalisation
 * de l’écriture) : rien n’est « reconnu » par ressemblance. Plusieurs candidats = ambigu, l’utilisateur choisit.
 * Tout le reste est « non vérifié ».
 */
import { normAr } from './ar-norm';
import { DUAS_LIST } from './duas';
import { NAMES, NAMES_REF, nameCall, nameBare, nameCallTr } from './names';
import { matchQuran, type QuranIndex, type QuranProposal } from './quran-match';
import { SALAWAT } from './salawat';
import { SURAHS } from './surahs';
import { FORMULAS } from './tijani';
import type { ZikrItem } from './zikr';
import type { ProgramStep } from './program-parse';

export type CatalogEntry = {
  id: string;
  kind: ZikrItem['kind'];
  label: string;
  ar: string;
  tr?: string;
  fr?: string;
  ref: string;
  abjadAr?: string;
  /** Nombre de répétitions indiqué par la source du catalogue (pour information). */
  reps?: number;
  /** Clé arabe normalisée. */
  key: string;
  /** Clés latines normalisées (titre, translittération). */
  lat: string[];
};

/** Formes de présentation arabes (ligatures des PDF) → lettres de base. ﷺ et les autres signes U+FDF0–FDFF sauf ﷲ restent intacts. */
export function fixPresentation(s: string): string {
  return s.replace(/[\uFB50-\uFDCF\uFDF2\uFE70-\uFEFF]/g, (c) => c.normalize('NFKC'));
}
export const arKey = (s: string) => normAr(fixPresentation(s));

/** Latin : minuscules, sans accents ni signes, lettres doublées réduites, y → i (« Haylala » = « Hailala »). */
export function latKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1');
}

const TIJANI_REF = 'Formule du catalogue Zikru (rubrique Tijāniyya)';

let cached: CatalogEntry[] | null = null;
/** Catalogue de référence (une entrée par texte arabe distinct). La Fatiha et les du‘as coraniques passent par le Coran. */
export function buildCatalog(): CatalogEntry[] {
  if (cached) return cached;
  const byKey = new Map<string, CatalogEntry>();
  const add = (e: Omit<CatalogEntry, 'key' | 'lat'>, lat: string[]) => {
    const key = arKey(e.ar);
    if (!key) return;
    const keys = lat.map(latKey).filter((k) => k.length >= 5);
    const prev = byKey.get(key);
    if (prev) {
      for (const k of keys) if (!prev.lat.includes(k)) prev.lat.push(k);
      return;
    }
    byKey.set(key, { ...e, key, lat: [...new Set(keys)] });
  };
  for (const s of SALAWAT) add({ id: s.id, kind: 'salat', label: s.title, ar: s.ar, tr: s.tr, fr: s.fr, ref: s.ref }, [s.title, s.tr]);
  for (const f of Object.values(FORMULAS)) {
    if (f.id === 'fatiha') continue;
    add({ id: 'tijani-' + f.id, kind: f.id === 'fatih' || f.id === 'jawhara' ? 'salat' : 'dua', label: f.title, ar: f.ar, tr: f.tr, fr: f.fr, ref: TIJANI_REF }, [f.title, f.tr]);
  }
  for (const d of DUAS_LIST) add({ id: d.id, kind: 'dua', label: d.title, ar: d.ar, tr: d.tr, fr: d.fr, ref: d.ref, reps: d.reps }, [d.tr]);
  for (const n of NAMES) {
    const e = { id: 'name-' + n.n, kind: 'name' as const, label: nameCallTr(n.tr), ar: nameCall(n.ar), abjadAr: nameBare(n.ar), tr: nameCallTr(n.tr), fr: n.fr, ref: `Nom n° ${n.n} · ${NAMES_REF}` };
    add(e, [nameCallTr(n.tr)]);
    // le Nom seul (« اللطيف ») renvoie à la même entrée
    const bare = arKey(n.ar);
    if (bare && !byKey.has(bare)) byKey.set(bare, { ...e, key: bare, lat: [] });
  }
  cached = [...byKey.values()];
  return cached;
}

export type StepMatch =
  /** loose : mêmes lettres, dans le même ordre, mais espaces différents (texte extrait d’un PDF ou d’une photo). */
  | { type: 'catalog'; entry: CatalogEntry; loose?: boolean }
  | { type: 'quran'; p: QuranProposal; loose?: boolean }
  | { type: 'near'; p: QuranProposal }
  | { type: 'ambiguous'; options: CatalogEntry[] }
  | { type: 'none'; reason: 'empty' | 'latin' | 'no-match' | 'too-short' | 'no-index' };

/** Rapproche le texte d’une étape. `idx` absent : seul le catalogue est consulté (le Coran n’est pas encore chargé). */
const MIN_LOOSE = 8;
const looseCache = new WeakMap<QuranIndex, Map<string, number[]>>();
/** Versets entiers, lettres normalisées sans espaces → indices (couche « simple »). */
function looseVerses(idx: QuranIndex): Map<string, number[]> {
  let m = looseCache.get(idx);
  if (!m) {
    m = new Map();
    idx.simpleWords.forEach((w, i) => {
      const k = w.join('');
      m!.set(k, [...(m!.get(k) ?? []), i]);
    });
    looseCache.set(idx, m);
  }
  return m;
}

export function matchStepText(ar: string, latin: string, idx: QuranIndex | null, catalog = buildCatalog()): StepMatch {
  const k = arKey(ar);
  if (k) {
    const hits = catalog.filter((e) => e.key === k);
    if (hits.length === 1) return { type: 'catalog', entry: hits[0] };
    if (hits.length > 1) return { type: 'ambiguous', options: hits };
    // Repli : mêmes lettres sans tenir compte des espaces (les PDF coupent souvent les mots arabes). Jamais plus court
    // que MIN_LOOSE lettres, et toujours sur la formule entière : aucune correspondance partielle.
    const flat = k.replace(/ /g, '');
    const loose = flat.length >= MIN_LOOSE ? catalog.filter((e) => e.key.replace(/ /g, '') === flat) : [];
    if (loose.length === 1) return { type: 'catalog', entry: loose[0], loose: true };
    if (loose.length > 1) return { type: 'ambiguous', options: loose };
    if (!idx) return { type: 'none', reason: 'no-index' };
    const q = matchQuran(idx, fixPresentation(ar));
    if (q.level === 'exact') return { type: 'quran', p: q.best };
    const v = flat.length >= MIN_LOOSE ? looseVerses(idx).get(flat) : undefined;
    if (v && v.length === 1) {
      const i = v[0];
      const { s, a } = idx.verses[i];
      const ref = `${s}:${a}`;
      return { type: 'quran', loose: true, p: { level: 'exact', kind: 'ayah', s, a, b: a, ref, official: idx.uth[i].join(' '), whole: true, basmala: false, diff: 0, words: idx.simpleWords[i].length, also: [] } };
    }
    if (q.level === 'near') return { type: 'near', p: q.best };
    return { type: 'none', reason: q.level === 'none' && q.reason === 'too-short' ? 'too-short' : 'no-match' };
  }
  const l = latKey(latin);
  if (!l) return { type: 'none', reason: 'empty' };
  const hits = catalog.filter((e) => e.lat.includes(l));
  if (hits.length === 1) return { type: 'catalog', entry: hits[0] };
  if (hits.length > 1) return { type: 'ambiguous', options: hits };
  return { type: 'none', reason: 'latin' };
}

/** Élément de composition (Tasbih) issu d’une étape validée. */
export type ImportVia = 'paste' | 'photo' | 'pdf';
export function stepToItem(
  step: Pick<ProgramStep, 'ar' | 'latin' | 'hint'> & { count: number },
  m: StepMatch,
  useOfficial: boolean,
  via: ImportVia,
  photo?: string,
): Omit<ZikrItem, 'id'> {
  const reps = Math.max(1, Math.min(100000, Math.round(step.count)));
  if (useOfficial && m.type === 'catalog') {
    const e = m.entry;
    return { kind: e.kind, ref: e.ref, label: e.label, ar: e.ar, abjadAr: e.abjadAr, tr: e.tr, fr: e.fr, reps, via, ...(photo ? { photo } : {}) };
  }
  if (useOfficial && m.type === 'quran') {
    const ref = m.p.kind === 'partial' ? `${m.p.ref} (extrait)` : m.p.ref;
    return { kind: 'verse', ref: 'Coran ' + ref, label: `${SURAHS[m.p.s - 1]?.[2] ?? 'Coran'} ${ref}`, ar: m.p.official, reps, via, ...(photo ? { photo } : {}) };
  }
  const own = step.ar.trim() || step.latin.trim();
  const label = (step.hint || step.latin || own).slice(0, 60);
  return { kind: 'free', ref: 'Texte personnel', label, ar: own, reps, via, unverified: true, ...(photo ? { photo } : {}) };
}
