/**
 * Recette de zikr (photo, collage) : étapes, répétitions, dédicace, prérequis, invocation, variantes.
 * Tout est lu sur l’appareil. Une formule n’est liée au texte de référence que si son nom est reconnu
 * (Fatiha, Salat al-Fatih, etc.). Le reste reste le texte source, marqué incertain.
 */
import { FATIHA_AR, FATIHA_FR, FATIHA_TR } from './fatiha';
import { latinDigits } from './program-parse';
import { FORMULAS } from './tijani';
import type { ZikrItem, ZikrKind } from './zikr';

export type FormulaId = 'fatiha' | 'fatih' | 'jawhara' | 'istighfar' | 'hailala' | 'salawat' | 'free';
export type StageKind = 'prerequisite' | 'step' | 'invocation';

export type RecipeFormula = {
  id: FormulaId;
  label: string;
  /** Texte de référence si la formule est connue, sinon le passage lu. */
  ar: string;
  tr?: string;
  fr?: string;
  kind: ZikrKind;
  ref?: string;
  count: number;
  countRaw: string;
  sure: boolean;
};

export type RecipeStage = {
  kind: StageKind;
  optional: boolean;
  /** Inclus dans la composition. Un prérequis est proposé, pas imposé. */
  include: boolean;
  formulas: RecipeFormula[];
  dedication: string;
  /** 0 à 1. */
  confidence: number;
  /** Passages de la source à surligner (non reconnus). */
  uncertain: string[];
  source: string;
};

export type ParsedRecipe = {
  recognized: boolean;
  title: string;
  /** Ouvrage ou maître cité. */
  sourceName: string;
  aim: string;
  variant: string;
  /** Total annoncé par le texte (ex. 50), ou null. */
  namedTotal: number | null;
  /** Somme des répétitions des étapes (hors prérequis et hors invocation). */
  countedTotal: number;
  namesNote: string;
  signature: string;
  notes: string[];
  stages: RecipeStage[];
};

const REF = 'Formule du catalogue Zikru (rubrique Tijāniyya)';

const KNOWN: { id: FormulaId; re: RegExp; label: string; ar: string; tr?: string; fr?: string; kind: ZikrKind; ref?: string }[] = [
  { id: 'fatih', re: /صلاة\s+الفاتح|salat\s+al[-\s]?fati[hḥ]/gi, label: 'Salat al-Fatih', ar: FORMULAS.fatih.ar, tr: FORMULAS.fatih.tr, fr: FORMULAS.fatih.fr, kind: 'salat', ref: REF },
  { id: 'jawhara', re: /جوهرة\s+الكمال|jawharat(?:\s+al[-\s]?kamal)?/gi, label: 'Jawharat al-Kamal', ar: FORMULAS.jawhara.ar, tr: FORMULAS.jawhara.tr, fr: FORMULAS.jawhara.fr, kind: 'salat', ref: REF },
  { id: 'istighfar', re: /استغفار|أَ?ستغفر\s+الله|istighf[aā]r/gi, label: 'Istighfar', ar: FORMULAS.istighfar.ar, tr: FORMULAS.istighfar.tr, fr: FORMULAS.istighfar.fr, kind: 'dua', ref: REF },
  { id: 'hailala', re: /لا\s+إله\s+إلا\s+الله|tahl[iī]l|hay?lala|hailala/gi, label: 'Tahlil', ar: FORMULAS.hailala.ar, tr: FORMULAS.hailala.tr, fr: FORMULAS.hailala.fr, kind: 'dua', ref: REF },
  { id: 'salawat', re: /الصلاة\s+على\s+النبي|salaw[aā]t/gi, label: 'Salawat', ar: 'اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ', tr: 'Allāhumma ṣalli ʿalā sayyidinā Muḥammad', fr: 'Ô Allah, prie sur notre maître Muhammad.', kind: 'salat', ref: REF },
  { id: 'fatiha', re: /سورة\s+الفاتحة|(?:^|[^\u0621-\u064A])الفاتحة|al[-\s]?f[aā]ti[hḥ]a|\bfatiha\b/gi, label: 'Al-Fatiha', ar: FATIHA_AR, tr: FATIHA_TR, fr: FATIHA_FR, kind: 'verse', ref: '1:1-7' },
];

const WORD_COUNT: [RegExp, number][] = [
  [/ثلاث(?:ة|اً)?|trois|three/i, 3],
  [/أربع(?:ة)?|اربع(?:ة)?|quatre|four/i, 4],
  [/خمس(?:ة)?|cinq|five/i, 5],
  [/ست(?:ة)?|six/i, 6],
  [/سبع(?:ة)?|sept|seven/i, 7],
  [/مرتين|مرتين|twice|deux\s+fois|two\s+times/i, 2],
  [/مرة\s+واحدة|once|une\s+fois|one\s+time/i, 1],
];

type CountHit = { n: number; raw: string; sure: boolean; start: number; end: number };

function findCount(slice: string, base: number): CountHit | null {
  const patterns: { re: RegExp; n: (m: RegExpExecArray) => number; sure: boolean }[] = [
    { re: /[×xX✕✖]\s*(\d{1,4})/u, n: (m) => +m[1], sure: true },
    { re: /(\d{1,4})\s*[×xX✕✖]/u, n: (m) => +m[1], sure: true },
    { re: /(\d{1,4})\s*(?:مرات|مرة|fois|times?)/iu, n: (m) => +m[1], sure: true },
    { re: /(?:مرات|مرة|fois|times?)\s*(\d{1,4})/iu, n: (m) => +m[1], sure: true },
  ];
  for (const p of patterns) {
    const m = p.re.exec(slice);
    if (m && p.n(m) > 0) return { n: p.n(m), raw: m[0].trim(), sure: p.sure, start: base + m.index, end: base + m.index + m[0].length };
  }
  for (const [re, n] of WORD_COUNT) {
    const m = re.exec(slice);
    if (!m) continue;
    const after = slice.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (/^\s*(?:مرات|مرة|fois|times)/i.test(after) || n <= 2) {
      const raw = slice.slice(m.index, m.index + m[0].length + (after.match(/^\s*(?:مرات|مرة|fois|times)/i)?.[0].length ?? 0)).trim();
      return { n, raw, sure: true, start: base + m.index, end: base + m.index + raw.length };
    }
  }
  return null;
}

function formulasIn(norm: string, raw: string): { formula: RecipeFormula; end: number }[] {
  const hits: { id: FormulaId; start: number; end: number }[] = [];
  for (const k of KNOWN) {
    k.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = k.re.exec(norm))) {
      const start = m.index;
      const end = start + m[0].length;
      if (hits.some((h) => start < h.end && end > h.start)) continue;
      hits.push({ id: k.id, start, end });
      if (m[0].length === 0) break;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: { formula: RecipeFormula; end: number }[] = [];
  hits.forEach((h, i) => {
    const next = hits[i + 1]?.start ?? Math.min(norm.length, h.end + 48);
    const window = norm.slice(h.end, next);
    const before = norm.slice(Math.max(0, h.start - 16), h.start);
    const c = findCount(window, h.end) ?? findCount(before, Math.max(0, h.start - 16));
    if (!c) return;
    const spec = KNOWN.find((k) => k.id === h.id)!;
    out.push({
      end: Math.max(h.end, c.end),
      formula: {
        id: spec.id,
        label: spec.label,
        ar: spec.ar,
        tr: spec.tr,
        fr: spec.fr,
        kind: spec.kind,
        ref: spec.ref,
        count: c.n,
        countRaw: raw.slice(c.start, c.end).trim() || c.raw,
        sure: c.sure,
      },
    });
  });
  return out;
}

function dedicationOf(rest: string): string {
  const m = rest.match(/(?:لروح|إلى\s+روح|الى\s+روح|dédi\p{L}*\s+à\s+|offered\s+to\s+(?:the\s+soul\s+of\s+)?|for\s+the\s+soul\s+of\s+|pour\s+(?:l['’]âme\s+(?:de\s+|du\s+)?|sidi\s+))[\s\S]+/iu);
  if (!m) return '';
  return m[0].replace(/\s+/g, ' ').replace(/[.\s]+$/u, '').trim();
}

function isInvocation(s: string): boolean {
  return /تطلب|فتقول|تقول\s*[:：]|^\s*(?:puis|then|ensuite)?\s*(?:dire|dites|say|you\s+say)\b/iu.test(s);
}

function invocationOf(norm: string, raw: string): RecipeFormula | null {
  const say = /(?:فتقول|تقول)\s*[:：]?\s*|^\s*(?:puis|then|ensuite)?\s*(?:dire|dites|say|you\s+say)\s*[:：]?\s*/iu.exec(norm);
  const body = say ? norm.slice(say.index + say[0].length) : norm;
  const bodyBase = say ? say.index + say[0].length : 0;
  const c = findCount(body, bodyBase);
  let ar = body;
  if (c) ar = (body.slice(0, c.start - bodyBase) + ' ' + body.slice(c.end - bodyBase)).trim();
  ar = raw.slice(bodyBase, bodyBase + ar.length).replace(/\s+/g, ' ').replace(/^[:：\s]+/, '').trim();
  // Le texte officiel de la du‘a est le passage lu, pas une formule du catalogue.
  const fromRaw = (() => {
    const marker = /(?:فتقول|تقول)\s*[:：]?\s*|^\s*(?:puis|then|ensuite)?\s*(?:dire|dites|say|you\s+say)\s*[:：]?\s*/iu.exec(raw);
    if (!marker) return ar;
    let t = raw.slice(marker.index + marker[0].length);
    const cut = findCount(latinDigits(t), 0);
    if (cut) t = t.slice(0, cut.start);
    return t.replace(/\s+/g, ' ').replace(/^[:：\s]+/, '').trim();
  })();
  const text = fromRaw || ar;
  if (!text || !c) return null;
  return { id: 'free', label: 'Invocation', ar: text, kind: 'free', count: c.n, countRaw: c.raw, sure: c.sure };
}

function splitParts(norm: string): { intro: string; parts: { start: number; text: string }[] } {
  const re = /(?:^|\n)\s*(?=يقرأ)|ثم\s+(?=يقرأ|تطلب|اقرأ)|(?:^|\n)\s*(?=(?:puis|then|ensuite)\b)/gi;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    starts.push(m.index);
    if (m[0].length === 0) re.lastIndex++;
  }
  const uniq = [...new Set(starts)].sort((a, b) => a - b);
  if (!uniq.length) return { intro: norm, parts: [] };
  const intro = norm.slice(0, uniq[0]);
  const parts = uniq.map((s, i) => {
    const full = norm.slice(s, uniq[i + 1] ?? norm.length);
    const stripped = full.replace(/^\s*ثم\s+/u, '');
    const trimmed = stripped.trim();
    const lead = full.length - stripped.length + (stripped.length - stripped.trimStart().length);
    return { start: s + lead, text: trimmed };
  });
  return { intro, parts };
}

function cutNote(part: string): { body: string; tail: string } {
  const m = /(?:^|\n)\s*(?:وفي\s+رواية|variante\s*:|variant\s*:|note\s*:)/iu.exec(part);
  if (!m) return { body: part, tail: '' };
  return { body: part.slice(0, m.index).trim(), tail: part.slice(m.index).trim() };
}

function stageOf(body: string, rawSlice: string): RecipeStage | null {
  const inv = isInvocation(body);
  if (inv) {
    const f = invocationOf(body, rawSlice);
    if (!f) return null;
    return { kind: 'invocation', optional: false, include: true, formulas: [f], dedication: '', confidence: f.sure ? 0.86 : 0.6, uncertain: f.sure ? [] : [f.countRaw], source: rawSlice.trim() };
  }
  const found = formulasIn(body, rawSlice);
  if (!found.length) return null;
  const last = found[found.length - 1].end;
  const dedication = dedicationOf(body.slice(last));
  const sure = found.every((f) => f.formula.sure);
  let confidence = sure ? 0.93 : 0.7;
  const uncertain: string[] = [];
  if (!dedication && /لروح|يهدي\s+ثوابها|dédi|offered|soul/i.test(body)) {
    confidence = 0.62;
    uncertain.push(body.slice(last).trim().slice(0, 80));
  }
  return {
    kind: 'step',
    optional: false,
    include: true,
    formulas: found.map((f) => f.formula),
    dedication,
    confidence,
    uncertain: uncertain.filter(Boolean),
    source: rawSlice.trim(),
  };
}

function prerequisite(intro: string): RecipeStage | null {
  if (!/ركعتين|ركعتان|rak['’]?as?|rakat/i.test(intro)) return null;
  const only = /الفاتحة\s+فقط|fatiha\s+(?:seule|only)|only(?:\s+the)?\s+fatiha/i.test(intro);
  const spec = KNOWN.find((k) => k.id === 'fatiha')!;
  return {
    kind: 'prerequisite',
    optional: /من\s+أراد|optionnel|optional|if\s+you\s+(?:wish|want)/i.test(intro),
    include: true,
    formulas: [{ id: 'fatiha', label: spec.label, ar: spec.ar, tr: spec.tr, fr: spec.fr, kind: spec.kind, ref: spec.ref, count: 2, countRaw: /ركعتين|2\s*rak/i.exec(intro)?.[0] ?? '2', sure: true }],
    dedication: only ? (/[\u0600-\u06FF]/.test(intro) ? 'في كل ركعة: سورة الفاتحة فقط، وبعد السلام' : 'Fatiha only in each rakʿa, then the salam') : '',
    confidence: only ? 0.9 : 0.72,
    uncertain: only ? [] : [intro.trim().slice(0, 80)],
    source: (intro.match(/[^\n]*ركعتين[^\n]*|[^.\n]*rak['’]?as?[^\n.]*/i)?.[0] ?? intro).replace(/\s+/g, ' ').trim(),
  };
}

export function parseRecipe(original: string): ParsedRecipe {
  const raw = original.replace(/\r\n?/g, '\n');
  const norm = latinDigits(raw);
  const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  let title = '';
  if (lines[0] && !/^(?:ومن|source|from|but|aim)\b/i.test(lines[0]) && !/يقرأ|ركعتين/.test(lines[0])) {
    title = lines[0];
    if (lines[1] && /^رضي الله/.test(lines[1])) title = `${title} ${lines[1]}`;
  }
  const sourceName = (norm.match(/فوائد\s+سيدي\s+[\u0600-\u06FF\s]+?(?=رضي|،|,|قال)/)?.[0] ?? norm.match(/fawa['’]?id\s+(?:de|of)\s+[^.\n]+/i)?.[0] ?? '').replace(/\s+/g, ' ').trim();
  const aim = /حاج/.test(norm) ? 'قضاء حاجة' : (norm.match(/(?:but|aim)\s*:\s*([^\n.]+)/i)?.[1] ?? (/hajah|obtenir une hajah/i.test(norm) ? 'obtenir une hajah' : '')).trim();
  const variant = (norm.match(/في\s+رواية\s+([^،,.\n]+)/)?.[1] ?? norm.match(/(?:variante|variant)\s*:\s*([^\n]+)/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const named = norm.match(/(?:ب?مجموع|بجموع)\s+ال?[اأ]عداد\s+(\d{1,4})/i) ?? norm.match(/total\s+(?:des\s+)?(?:nombres|numbers|counts)?\s*[:=]?\s*(\d{1,4})/i);
  const namedTotal = named ? +named[1] : null;
  const namesNote = (norm.match(/واحد\s+[أا]حد\s+حي/)?.[0] ?? norm.match(/wahid\s+ahad\s+hayy/i)?.[0] ?? '').replace(/\s+/g, ' ');
  const signature = (raw.match(/الشيخ\s+أبو\s+بكر[\s\S]*?آمين/)?.[0] ?? raw.match(/الشيخ\s+أبو\s+بكر[^\n]*/)?.[0] ?? '').replace(/\s+/g, ' ').trim();

  const { intro, parts } = splitParts(norm);
  const stages: RecipeStage[] = [];
  const pre = prerequisite(intro);
  if (pre) stages.push(pre);
  const notes: string[] = [];
  for (const part of parts) {
    const { body, tail } = cutNote(part.text);
    if (tail) notes.push(tail.replace(/\s+/g, ' ').trim());
    const stage = stageOf(body, raw.slice(part.start, part.start + body.length));
    if (stage) stages.push(stage);
    else if (body.trim()) notes.push(body.trim());
  }
  if (variant) notes.unshift(variant);
  const countedTotal = stages.filter((s) => s.kind === 'step').reduce((a, s) => a + s.formulas.reduce((b, f) => b + f.count, 0), 0);
  if (namedTotal != null && namedTotal !== countedTotal) {
    for (const s of stages) if (s.kind === 'step') s.confidence = Math.min(s.confidence, 0.7);
  }
  const recognized = stages.some((s) => s.kind === 'step' && s.formulas.length > 0) && (stages.filter((s) => s.kind === 'step').length > 1 || stages.some((s) => s.dedication || s.kind === 'prerequisite' || s.kind === 'invocation'));
  return { recognized, title, sourceName, aim, variant, namedTotal, countedTotal, namesNote, signature, notes, stages };
}

/** Étapes réellement récitées (prérequis retiré si l’utilisateur l’a décoché). */
export function recipeFlat(r: ParsedRecipe): { stage: RecipeStage; formula: RecipeFormula }[] {
  const out: { stage: RecipeStage; formula: RecipeFormula }[] = [];
  for (const stage of r.stages) {
    if (!stage.include) continue;
    for (const formula of stage.formulas) out.push({ stage, formula });
  }
  return out;
}

export function recipeToItem(stage: RecipeStage, formula: RecipeFormula, via: ZikrItem['via']): Omit<ZikrItem, 'id'> {
  const dedication = stage.dedication.trim();
  const fr = [formula.fr, dedication].filter(Boolean).join('\n');
  return {
    kind: formula.kind,
    ref: formula.ref,
    label: formula.label,
    ar: formula.ar,
    tr: formula.tr,
    fr: fr || undefined,
    reps: Math.max(1, Math.min(100000, Math.round(formula.count))),
    via,
    unverified: formula.id === 'free' || !formula.sure,
    dedication: dedication || undefined,
    role: stage.kind,
    optional: stage.optional,
  };
}
