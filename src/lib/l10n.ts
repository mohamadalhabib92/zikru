/**
 * Traduction des chaînes d'interface écrites en français dans les écrans.
 * - Clé = texte français exact ; valeur = [anglais, arabe] (catalogue `UI_STRINGS`).
 * - `L('…')` / `L('{n} jours', { n })` : traduction explicite (alertes, placeholders, gabarits).
 * - Le composant `Text` de `@/ui/Text` traduit aussi automatiquement les enfants texte connus du catalogue.
 * - Jamais pour les textes religieux (Coran, hadith, du‘a) : ceux-ci ont leurs propres champs sourcés.
 * - Allemand, pulaar, wolof : repli sur le français pour ces chaînes (non couvertes par P5).
 */
import { createContext, useContext } from 'react';
import type { Lang } from './i18n';
import { UI_STRINGS } from './ui-strings';

let cur: Lang = 'fr';
export function setUiLang(l: Lang) {
  cur = l;
}
export function uiLang(): Lang {
  return cur;
}
export const UiLangContext = createContext<Lang>('fr');
/** Abonne un composant aux changements de langue (re-rendu) et renvoie la langue courante. */
export function useUiLang(): Lang {
  return useContext(UiLangContext);
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const fill = (s: string, vars?: Record<string, string | number | null | undefined>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? "") : m)) : s);

/** Cherche la traduction d'une chaîne française (null si absente du catalogue ou langue sans catalogue). */
export function lookup(fr: string, lang: Lang = cur): string | null {
  if (lang !== 'en' && lang !== 'ar') return null;
  const e = UI_STRINGS[fr] ?? UI_STRINGS[norm(fr)];
  if (!e) return null;
  return lang === 'en' ? e[0] : e[1];
}
/** Traduit une chaîne française d'interface (gabarit `{var}` accepté). */
export function L(fr: string, vars?: Record<string, string | number | null | undefined>, lang: Lang = cur): string {
  const r = lookup(fr, lang);
  if (r == null) return fill(fr, vars);
  const lead = fr.match(/^\s*/)![0];
  const trail = fr.match(/\s*$/)![0];
  return fill(lead + r + trail, vars);
}
/** Traduit une chaîne en conservant les espaces de bord (morceaux de texte JSX). */
export function translatePiece(s: string, lang: Lang): string {
  if (lang !== 'en' && lang !== 'ar') return s;
  const t = s.trim();
  if (!t) return s;
  const r = lookup(t, lang);
  if (r == null) return s;
  const lead = s.slice(0, s.indexOf(t[0]));
  const trail = s.slice(s.lastIndexOf(t[t.length - 1]) + 1);
  return lead + r + trail;
}
