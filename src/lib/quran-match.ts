/**
 * Reconnaissance de versets coraniques dans un texte collé ou photographié (module pur, testé par
 * scripts/test-quran-match.mjs). Le texte de l’utilisateur n’est JAMAIS modifié ici : on renvoie seulement
 * une proposition (texte uthmani Tanzil exact + référence) que l’utilisateur accepte ou refuse d’un geste.
 *
 * Niveaux de résultat :
 *  - « exact »  : après normalisation (sans tashkīl / tatwīl, alif / yā’ / tā’ marbūṭa unifiés), le texte est
 *                 identique à un verset, à une suite de versets consécutifs (même sourate) ou à un extrait d’un verset ;
 *  - « near »   : ressemble à un passage mais diffère d’au moins un mot → jamais proposé comme identique,
 *                 l’interface affiche l’écart et le texte reste « source à vérifier » tant que l’utilisateur ne choisit pas ;
 *  - « none »   : aucune correspondance → texte conservé tel quel, « source à vérifier ».
 */
import { normAr } from './ar-norm';

export type TanzilVerse = { s: number; a: number; text: string };
export type MatchKind = 'ayah' | 'range' | 'partial';
export type QuranProposal = {
  /** exact = identique après normalisation ; near = ressemblant, au moins un mot diffère. */
  level: 'exact' | 'near';
  kind: MatchKind;
  s: number;
  /** Premier et dernier verset (inclus). */
  a: number;
  b: number;
  /** « 2:255 », « 2:1-5 ». */
  ref: string;
  /** Texte uthmani Tanzil, reproduit à l’identique (versets séparés par « ۝ »). */
  official: string;
  /** L’extrait officiel couvre tout le(s) verset(s) (false : extrait exact d’un verset). */
  whole: boolean;
  /** Le texte commençait par la basmala (ajoutée en tête du texte officiel, écriture Tanzil 1:1). */
  basmala: boolean;
  /** near : nombre de mots qui diffèrent ; exact : 0. */
  diff: number;
  /** Nombre de mots (normalisés) du texte fourni. */
  words: number;
  /** Autres emplacements identiques (ex. verset répété) : références. */
  also: string[];
};
export type MatchResult = { level: 'exact' | 'near'; best: QuranProposal } | { level: 'none'; reason: 'empty' | 'not-arabic' | 'too-short' | 'no-match' };

const BASMALA_N = 'بسم الله الرحمن الرحيم';
/** Séparateur de versets utilisé partout dans l’app pour un passage de plusieurs versets. */
export const VERSE_SEP = ' ۝ ';

/** Lit le format Tanzil « sourate|verset|texte » (lignes # = copyright, ignorées). */
export function parseTanzil(raw: string): TanzilVerse[] {
  const out: TanzilVerse[] = [];
  for (const line of raw.split('\n')) {
    if (!line || line[0] === '#') continue;
    const i = line.indexOf('|'), j = line.indexOf('|', i + 1);
    if (i < 0 || j < 0) continue;
    out.push({ s: +line.slice(0, i), a: +line.slice(i + 1, j), text: line.slice(j + 1) });
  }
  return out;
}

/** Jetons « mots » d’un verset : chaque signe de pause isolé (ۖ ۚ …) reste attaché au mot précédent. */
function tokens(text: string): string[] {
  const out: string[] = [];
  for (const t of text.split(/\s+/)) {
    if (!t) continue;
    if (normAr(t) === '' && out.length) out[out.length - 1] += ' ' + t;
    else out.push(t);
  }
  return out;
}
/** Retire les 4 mots de la basmala placés en tête du verset 1 (sauf al-Fātiḥa), comme le lecteur. */
function dropBasmala(s: number, a: number, toks: string[]): string[] {
  if (s === 1 || a !== 1 || toks.length <= 4) return toks;
  return normAr(toks.slice(0, 4).join(' ')) === BASMALA_N ? toks.slice(4) : toks;
}

type Layer = { keys: string[]; corpus: string; starts: number[] };
export type QuranIndex = {
  verses: { s: number; a: number }[];
  /** Jetons uthmani (texte officiel) par verset, basmala d’ouverture retirée. */
  uth: string[][];
  /** Basmala uthmani telle qu’écrite dans la ligne Tanzil (verset 1 des sourates) ; 1:1 sinon. */
  head: Map<number, string>;
  /** Mots normalisés : couche « simple » (orthographe courante) et couche « uthmani ». */
  layers: Layer[];
  simpleWords: string[][];
  /** Mot (squelette) → versets qui le contiennent, pour la recherche approchée. */
  inv: Map<string, number[]>;
};

function layer(keys: string[]): Layer {
  const starts: number[] = [];
  let pos = 1;
  for (const k of keys) {
    starts.push(pos);
    pos += k.length + 1;
  }
  return { keys, corpus: ' ' + keys.join(' ') + ' ', starts };
}
/** Squelette d’un mot pour la comparaison approchée : sans alif médian ni final (لقمان ≈ لقمن). */
const skel = (w: string) => (w.length > 2 ? w[0] + w.slice(1).replace(/ا/g, '') : w);

/** Construit l’index à partir des deux éditions Tanzil embarquées (Simple + Uthmani, même découpage). */
export function buildIndex(simpleRaw: string, uthmaniRaw: string): QuranIndex {
  const sv = parseTanzil(simpleRaw), uv = parseTanzil(uthmaniRaw);
  if (sv.length !== uv.length) throw new Error('éditions Tanzil incohérentes');
  const verses = sv.map((v) => ({ s: v.s, a: v.a }));
  const head = new Map<number, string>();
  const uth = uv.map((v, i) => {
    const all = tokens(v.text), kept = dropBasmala(v.s, v.a, all);
    if (kept.length < all.length) head.set(i, all.slice(0, all.length - kept.length).join(' '));
    return kept;
  });
  const simpleWords = sv.map((v) => normAr(dropBasmala(v.s, v.a, tokens(v.text)).join(' ')).split(' ').filter(Boolean));
  const uthKeys = uth.map((t) => normAr(t.join(' ')));
  const inv = new Map<string, number[]>();
  simpleWords.forEach((ws, i) => {
    for (const w of new Set(ws.map(skel))) {
      const l = inv.get(w);
      if (l) l.push(i);
      else inv.set(w, [i]);
    }
  });
  return { verses, uth, head, layers: [layer(simpleWords.map((w) => w.join(' '))), layer(uthKeys)], simpleWords, inv };
}

/** Basmala à placer devant un passage : celle de la ligne Tanzil du verset 1, sinon le verset 1:1. */
const basmalaOf = (idx: QuranIndex, i0: number) => idx.head.get(i0) ?? idx.uth[0].join(' ');
const refOf = (s: number, a: number, b: number) => (a === b ? `${s}:${a}` : `${s}:${a}-${b}`);
/** Index du verset contenant la position p du corpus. */
function verseAt(starts: number[], p: number): number {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= p) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Texte officiel d’un passage : extrait exact de jetons uthmani si l’alignement mot à mot est sûr, sinon versets entiers. */
function officialText(idx: QuranIndex, i0: number, i1: number, w0: number, w1: number, li: number, whole: boolean): { text: string; whole: boolean } {
  const all = { text: idx.uth.slice(i0, i1 + 1).map((t) => t.join(' ')).join(VERSE_SEP), whole: true };
  if (whole || i0 !== i1) return all;
  const toks = idx.uth[i0];
  // Chaque jeton uthmani doit donner exactement un mot normalisé, et la couche utilisée avoir le même nombre de mots.
  if (toks.some((t) => normAr(t).split(' ').length !== 1)) return all;
  if (li === 0 && idx.simpleWords[i0].length !== toks.length) return all;
  return { text: toks.slice(w0, w1 + 1).join(' '), whole: false };
}

/** Correspondances exactes (couche simple puis uthmani). */
function exactHits(idx: QuranIndex, q: string): { li: number; i0: number; i1: number; w0: number; w1: number; whole: boolean }[] {
  const out: { li: number; i0: number; i1: number; w0: number; w1: number; whole: boolean }[] = [];
  const seen = new Set<string>();
  idx.layers.forEach((L, li) => {
    const needle = ' ' + q + ' ';
    let from = 0;
    while (out.length < 60) {
      const p = L.corpus.indexOf(needle, from);
      if (p < 0) break;
      from = p + 1;
      const start = p + 1, end = p + needle.length - 2; // dernier caractère
      const i0 = verseAt(L.starts, start), i1 = verseAt(L.starts, end);
      if (idx.verses[i0].s !== idx.verses[i1].s) continue; // jamais à cheval sur deux sourates
      const k = `${i0}-${i1}-${start - L.starts[i0]}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const pre0 = L.corpus.slice(L.starts[i0], start).trim();
      const w0 = pre0 ? pre0.split(' ').length : 0;
      const w1 = L.corpus.slice(L.starts[i1], end + 1).trim().split(' ').length - 1;
      const startsAtVerse = start === L.starts[i0];
      const endsAtVerse = end + 1 === L.starts[i1] + L.keys[i1].length;
      out.push({ li, i0, i1, w0, w1, whole: startsAtVerse && endsAtVerse });
    }
  });
  return out;
}

/** Distance d’édition mot à mot, alignement « semi-global » : le texte peut commencer / finir n’importe où dans la référence. */
function align(q: string[], ref: string[]): { cost: number; from: number; to: number } {
  const n = q.length, m = ref.length;
  let prev = new Array<number>(m + 1).fill(0), prevS = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = new Array<number>(m + 1), curS = new Array<number>(m + 1);
    cur[0] = i;
    curS[0] = 0;
    for (let j = 1; j <= m; j++) {
      const same = q[i - 1] === ref[j - 1] ? 0 : skel(q[i - 1]) === skel(ref[j - 1]) ? 0.5 : 1;
      let best = prev[j - 1] + same, s = prevS[j - 1];
      if (prev[j] + 1 < best) (best = prev[j] + 1), (s = prevS[j]);
      if (cur[j - 1] + 1 < best) (best = cur[j - 1] + 1), (s = curS[j - 1]);
      cur[j] = best;
      curS[j] = s;
    }
    prev = cur;
    prevS = curS;
  }
  let cost = Infinity, to = 0;
  for (let j = 1; j <= m; j++) if (prev[j] < cost) (cost = prev[j]), (to = j);
  return { cost, from: prevS[to], to: to - 1 };
}

/** Recherche approchée : candidats par mots rares, puis alignement sur une fenêtre de versets consécutifs. */
function nearHit(idx: QuranIndex, words: string[]): { i0: number; i1: number; cost: number } | null {
  const score = new Map<number, number>();
  for (const w of new Set(words.map(skel))) {
    const l = idx.inv.get(w);
    if (!l || l.length > 400) continue; // mots trop fréquents : peu discriminants
    const wt = 1 / Math.log(2 + l.length);
    for (const i of l) score.set(i, (score.get(i) ?? 0) + wt);
  }
  const cands = [...score.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map((x) => x[0]);
  let best: { i0: number; i1: number; cost: number } | null = null;
  for (const c of cands) {
    const s = idx.verses[c].s;
    let lo = c;
    if (lo > 0 && idx.verses[lo - 1].s === s) lo--;
    const ref: string[] = [], owner: number[] = [];
    for (let i = lo; i < idx.verses.length && idx.verses[i].s === s && i <= c + 20; i++) {
      for (const w of idx.simpleWords[i]) (ref.push(w), owner.push(i));
      if (i >= c && ref.length >= words.length + 8) break;
    }
    const r = align(words, ref);
    if (!best || r.cost < best.cost) best = { i0: owner[r.from] ?? c, i1: owner[r.to] ?? c, cost: r.cost };
  }
  return best;
}

/**
 * Cherche le texte fourni dans le Coran embarqué. Ne modifie rien : renvoie une proposition ou « none ».
 * Règles : ≥ 3 mots pour un extrait (sinon trop ambigu), versets entiers acceptés dès 1 mot (ex. « الم » 2:1) ;
 * une ressemblance (« near ») n’est retenue que si ≤ 1/3 des mots diffèrent, et n’est jamais présentée comme identique.
 */
export function matchQuran(idx: QuranIndex, input: string): MatchResult {
  if (!input.trim()) return { level: 'none', reason: 'empty' };
  let q = normAr(input);
  if (!q) return { level: 'none', reason: 'not-arabic' };
  let basmala = false;
  if (q.startsWith(BASMALA_N + ' ')) {
    basmala = true;
    q = q.slice(BASMALA_N.length + 1);
  }
  const words = q.split(' ');
  const hits = exactHits(idx, q).filter((h) => h.whole || words.length >= 3);
  if (hits.length) {
    // Préférence : versets entiers, puis couche « simple », puis ordre du Mushaf.
    hits.sort((x, y) => Number(y.whole) - Number(x.whole) || x.li - y.li || x.i0 - y.i0);
    const h = hits[0];
    const { s, a } = idx.verses[h.i0], b = idx.verses[h.i1].a;
    const off = officialText(idx, h.i0, h.i1, h.w0, h.w1, h.li, h.whole);
    const kind: MatchKind = !h.whole ? 'partial' : h.i0 === h.i1 ? 'ayah' : 'range';
    const also = [...new Set(hits.slice(1).filter((x) => x.whole === h.whole).map((x) => refOf(idx.verses[x.i0].s, idx.verses[x.i0].a, idx.verses[x.i1].a)))].filter((r) => r !== refOf(s, a, b));
    return {
      level: 'exact',
      best: { level: 'exact', kind, s, a, b, ref: refOf(s, a, b), official: (basmala ? basmalaOf(idx, h.i0) + ' ' : '') + off.text, whole: off.whole, basmala, diff: 0, words: words.length, also: also.slice(0, 12) },
    };
  }
  if (words.length < 3) return { level: 'none', reason: 'too-short' };
  const nh = nearHit(idx, words);
  if (nh && nh.cost <= Math.max(1, Math.floor(words.length / 3))) {
    const { s, a } = idx.verses[nh.i0], b = idx.verses[nh.i1].a;
    const official = idx.uth.slice(nh.i0, nh.i1 + 1).map((t) => t.join(' ')).join(VERSE_SEP);
    return {
      level: 'near',
      best: { level: 'near', kind: nh.i0 === nh.i1 ? 'ayah' : 'range', s, a, b, ref: refOf(s, a, b), official: (basmala ? basmalaOf(idx, nh.i0) + ' ' : '') + official, whole: true, basmala, diff: Math.max(1, Math.ceil(nh.cost)), words: words.length, also: [] },
    };
  }
  return { level: 'none', reason: 'no-match' };
}

let idxP: Promise<QuranIndex> | null = null;
/** Index chargé à la demande (textes Tanzil embarqués, hors-ligne). */
export function loadQuranIndex(): Promise<QuranIndex> {
  if (!idxP)
    idxP = Promise.all([import('./quran-text'), import('./quran-uthmani')])
      .then(([t, u]) => buildIndex(t.QURAN_TEXT, u.QURAN_UTHMANI))
      .catch((e) => {
        idxP = null;
        throw e;
      });
  return idxP;
}
