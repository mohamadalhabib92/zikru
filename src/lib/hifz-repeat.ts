/**
 * File de répétition pour la mémorisation : un verset, une plage, ou la sourate entière.
 * Module pur (pas de React, pas d’audio). Le lecteur existant joue la file matérialisée.
 * 0 = infini : on ne construit jamais une file infinie.
 * Les cartes, le plan et les réglages `hifz-prefs` ne sont pas lus ici.
 */
import { buildQueue, ayahCount, type Step } from './recitation';

/** Nouvelle clé. Ne remplace pas hifz-prefs, hifz-cards, hifz-plan ni hifz-streak. */
export const HIFZ_REPEAT_KEY = 'hifz-repeat';

export const VERSE_REPEAT_CHOICES = [1, 3, 5, 7, 10, 20, 0] as const;
export const RANGE_REPEAT_CHOICES = [1, 2, 3, 5, 0] as const;
/** Mêmes paliers que le lecteur de sourate. 0 n’est pas une vitesse. */
export const REPEAT_RATES = [0.75, 1, 1.25, 1.5] as const;
export const PAUSE_MAX_SEC = 10;

export type RepeatScope = 'verse' | 'range' | 'sura';
export type RepeatSettings = {
  scope: RepeatScope;
  /** Répétitions de chaque verset. 0 = infini (on reste sur le verset jusqu’au verset suivant). */
  each: number;
  /** Répétitions de toute la plage ou de la sourate. 0 = infini. Sans effet tant que `each` est infini. */
  times: number;
  /** Silence après chaque lecture, en secondes entières de 0 à 10. */
  pauseSec: number;
  /** Vitesse. Ignorée par l’écran si le lecteur ne l’accepte pas ; la lecture continue. */
  rate: number;
};

export const DEFAULT_REPEAT: RepeatSettings = { scope: 'range', each: 3, times: 1, pauseSec: 0, rate: 1 };

const SCOPES: RepeatScope[] = ['verse', 'range', 'sura'];

export function clampSurah(s: number): number {
  const n = Math.round(Number(s));
  if (!Number.isFinite(n)) return 1;
  return Math.min(114, Math.max(1, n));
}

export function clampAyah(surah: number, a: number): number {
  const n = ayahCount(clampSurah(surah));
  const x = Math.round(Number(a));
  if (!n) return 1;
  if (!Number.isFinite(x)) return 1;
  return Math.min(n, Math.max(1, x));
}

export function clampPause(sec: number): number {
  const n = Math.round(Number(sec));
  if (!Number.isFinite(n)) return 0;
  return Math.min(PAUSE_MAX_SEC, Math.max(0, n));
}

function pickCount(n: unknown, choices: readonly number[], fallback: number): number {
  const x = Math.round(Number(n));
  return choices.includes(x) ? x : fallback;
}

export function clampRate(n: number): number {
  const x = Number(n);
  return (REPEAT_RATES as readonly number[]).includes(x) ? x : DEFAULT_REPEAT.rate;
}

export function parseScope(v: unknown): RepeatScope | null {
  return typeof v === 'string' && (SCOPES as string[]).includes(v) ? (v as RepeatScope) : null;
}

/** Valeur stockée illisible → réglages par défaut. Les champs inconnus sont ignorés. */
export function sanitizeRepeat(v: unknown): RepeatSettings {
  if (!v || typeof v !== 'object') return { ...DEFAULT_REPEAT };
  const o = v as Partial<RepeatSettings>;
  return {
    scope: parseScope(o.scope) ?? DEFAULT_REPEAT.scope,
    each: pickCount(o.each, VERSE_REPEAT_CHOICES, DEFAULT_REPEAT.each),
    times: pickCount(o.times, RANGE_REPEAT_CHOICES, DEFAULT_REPEAT.times),
    pauseSec: clampPause(typeof o.pauseSec === 'number' ? o.pauseSec : DEFAULT_REPEAT.pauseSec),
    rate: clampRate(typeof o.rate === 'number' ? o.rate : DEFAULT_REPEAT.rate),
  };
}

export type RepeatVerse = { s: number; a: number };

/** Versets réellement lus, bornés à la sourate. Une plage inversée est remise dans l’ordre. */
export function repeatVerses(scope: RepeatScope, surah: number, from: number, to: number): RepeatVerse[] {
  const s = clampSurah(surah);
  const n = ayahCount(s);
  if (!n) return [];
  if (scope === 'sura') return Array.from({ length: n }, (_, i) => ({ s, a: i + 1 }));
  if (scope === 'verse') return [{ s, a: clampAyah(s, from) }];
  const a = clampAyah(s, Math.min(from, to));
  const b = clampAyah(s, Math.max(from, to));
  const out: RepeatVerse[] = [];
  for (let k = a; k <= b; k++) out.push({ s, a: k });
  return out;
}

export type RepeatCursor = {
  verses: RepeatVerse[];
  /** Index dans `verses` (0 = premier). */
  index: number;
  /** Répétition en cours du verset, à partir de 1. */
  rep: number;
  /** Passage en cours de la plage, à partir de 1. */
  pass: number;
  each: number;
  times: number;
  pauseMs: number;
};

export function openCursor(settings: RepeatSettings, surah: number, from: number, to: number): RepeatCursor | null {
  const safe = sanitizeRepeat(settings);
  const verses = repeatVerses(safe.scope, surah, from, to);
  if (!verses.length) return null;
  return { verses, index: 0, rep: 1, pass: 1, each: safe.each, times: safe.times, pauseMs: safe.pauseSec * 1000 };
}

export type RepeatTick =
  | { kind: 'replay' | 'next'; cursor: RepeatCursor; pauseMs: number }
  | { kind: 'end' };

/**
 * À la fin du verset en cours.
 * `each` infini : on rejoue le même verset (le passage de plage n’avance pas).
 * `times` infini : après le dernier verset, on reprend au début, passage + 1.
 * La pause est entre les lectures, pas après la dernière.
 */
export function afterRepeat(c: RepeatCursor): RepeatTick {
  if (!c.verses.length || c.index < 0 || c.index >= c.verses.length) return { kind: 'end' };
  const pauseMs = Math.max(0, c.pauseMs);
  if (c.each === 0 || c.rep < c.each) {
    return { kind: 'replay', cursor: { ...c, rep: c.rep + 1 }, pauseMs };
  }
  if (c.index + 1 < c.verses.length) {
    return { kind: 'next', cursor: { ...c, index: c.index + 1, rep: 1 }, pauseMs };
  }
  if (c.times === 0 || c.pass < c.times) {
    return { kind: 'next', cursor: { ...c, index: 0, rep: 1, pass: c.pass + 1 }, pauseMs };
  }
  return { kind: 'end' };
}

/** Verset distinct suivant ou précédent. La répétition repart à 1. null = bord de la plage. */
export function skipRepeat(c: RepeatCursor, dir: 1 | -1): RepeatCursor | null {
  const i = c.index + dir;
  if (i < 0 || i >= c.verses.length) return null;
  return { ...c, index: i, rep: 1 };
}

/**
 * File finie pour le lecteur déjà en place.
 * - chaque verset infini : un seul pas, `loop` vrai (le même fichier repart).
 * - plage infinie : une passe, `loop` vrai.
 * - les deux finis : la file complète, sans boucle.
 */
export function materialize(c: RepeatCursor): { queue: Step[]; loop: boolean; start: number } {
  if (!c.verses.length || c.index < 0 || c.index >= c.verses.length) return { queue: [], loop: false, start: 0 };
  if (c.each === 0) {
    const v = c.verses[c.index];
    return { queue: buildQueue([[v.s, v.a]], 1, 1), loop: true, start: 0 };
  }
  const pairs = c.verses.map((v) => [v.s, v.a] as [number, number]);
  const queue = buildQueue(pairs, c.each, c.times === 0 ? 1 : c.times);
  const here = c.verses[c.index];
  const start = queue.findIndex((s) => s.s === here.s && s.a === here.a && s.rep === 1 && s.pass === 1);
  return { queue, loop: c.times === 0, start: start < 0 ? 0 : start };
}

export type RepeatProgress = {
  /** 1-based position in the selection. */
  i: number;
  n: number;
  r: number;
  /** 0 = infinity. */
  each: number;
  pass: number;
  /** 0 = infinity. 1 = a single pass, omitted from the label. */
  times: number;
};

export function progressOf(c: RepeatCursor): RepeatProgress {
  return { i: c.index + 1, n: c.verses.length, r: c.rep, each: c.each, pass: c.pass, times: c.times };
}

export function progressFromStep(verses: RepeatVerse[], step: Step | null | undefined, each: number, times: number): RepeatProgress | null {
  if (!step || !verses.length) return null;
  const i = verses.findIndex((v) => v.s === step.s && v.a === step.a);
  if (i < 0) return null;
  return { i: i + 1, n: verses.length, r: step.rep, each, pass: step.pass, times };
}

/** Clé française (catalogue) et variables. `p` vaut « ∞ » ou « 2/3 ». */
export function repeatProgressLabel(p: RepeatProgress): { key: string; vars: Record<string, string | number> } {
  if (p.each === 0) return { key: 'Verset {i}/{n} · répétition ∞', vars: { i: p.i, n: p.n } };
  const base = { i: p.i, n: p.n, r: p.r, e: p.each };
  if (p.times !== 1) {
    const pass = p.times === 0 ? '∞' : `${p.pass}/${p.times}`;
    return { key: 'Verset {i}/{n} · répétition {r}/{e} · passage {p}', vars: { ...base, p: pass } };
  }
  return { key: 'Verset {i}/{n} · répétition {r}/{e}', vars: base };
}

export function formatRepeatProgress(p: RepeatProgress): string {
  const { key, vars } = repeatProgressLabel(p);
  return key.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** Le lecteur divise la pause par la vitesse : on compense pour garder les secondes demandées. */
export function pauseGapSec(pauseSec: number, rate: number): number {
  const sec = clampPause(pauseSec);
  const r = rate > 0 && Number.isFinite(rate) ? rate : 1;
  return sec * r;
}

/**
 * expo-audio expose setPlaybackRate. Le lecteur avale un échec : une plateforme
 * sans vitesse joue quand même à vitesse normale. On propose le réglage partout.
 */
export function playbackRateSupported(): boolean {
  return true;
}
