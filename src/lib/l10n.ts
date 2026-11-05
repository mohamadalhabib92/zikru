/**
 * Traduction des chaînes d'interface écrites en français dans les écrans.
 * - Clé = texte français exact.
 * - en / ar : catalogue généré `UI_STRINGS`.
 * - de, de-CH et les langues `review` : `src/lib/ui-cat` (brouillon, pas une validation savante).
 * - Chaîne absente : le français source reste affiché. Jamais pour les textes religieux
 *   (Coran, hadith, du‘a) : ceux-ci ont leurs propres champs sourcés.
 */
import { createContext, useContext } from 'react';
import type { Lang } from './i18n';
import { UI_STRINGS } from './ui-strings';
import { uiCatalogText } from './ui-cat';

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
  if (lang === 'fr') return null;
  if (lang === 'en' || lang === 'ar') {
    const e = UI_STRINGS[fr] ?? UI_STRINGS[norm(fr)];
    if (!e) return null;
    return lang === 'en' ? e[0] : e[1];
  }
  const base = lang === 'de-CH' ? 'de' : lang;
  const hit = uiCatalogText(base, fr) ?? uiCatalogText(base, norm(fr));
  if (hit == null) return null;
  return lang === 'de-CH' ? hit.replace(/ß/g, 'ss') : hit;
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
  if (lang === 'fr') return s;
  const t = s.trim();
  if (!t) return s;
  const r = lookup(t, lang);
  if (r == null) return s;
  const lead = s.slice(0, s.indexOf(t[0]));
  const trail = s.slice(s.lastIndexOf(t[t.length - 1]) + 1);
  return lead + r + trail;
}
