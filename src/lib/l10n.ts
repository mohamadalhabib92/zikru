/**
 * Traduction des chaînes d'interface écrites en français dans les écrans.
 * - Clé = texte français exact ; un catalogue par langue (src/lib/ui-cat/<lang>.ts), chargé à la demande :
 *   le français (langue source) ne télécharge rien ; en / ar / de sont chargés au démarrage selon la langue choisie
 *   (`loadUiCatalog`, attendu par la racine), puis pré-cachés par le service worker (hors-ligne).
 * - `L('…')` / `L('{n} jours', { n })` : traduction explicite (alertes, placeholders, gabarits).
 * - Le composant `Text` de `@/ui/Text` traduit aussi automatiquement les enfants texte connus du catalogue.
 * - Jamais pour les textes religieux (Coran, hadith, du‘a) : ceux-ci ont leurs propres champs sourcés.
 * - Allemand (de) et suisse alémanique (de-CH, dérivé : « ß » → « ss ») : traduction NON RELUE, signalée dans l'app.
 * - Pulaar, wolof et les autres langues `review` sans catalogue : repli français.
 * - Chaînes d'interface absentes du catalogue paresseux (adhan, file, pratique) : repli sur `UI_STRINGS` pour en / ar.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { Lang } from './i18n';
import { UI_STRINGS } from './ui-strings';

type CatLang = 'en' | 'ar' | 'de';
const catLang = (l: Lang): CatLang | null => (l === 'en' || l === 'ar' ? l : l === 'de' || l === 'de-CH' ? 'de' : null);
const CATS: Partial<Record<CatLang, Record<string, string>>> = {};
const pending: Partial<Record<CatLang, Promise<void>>> = {};
/** Charge le catalogue principal de la langue (aucun pour le français). Ne rejette jamais : en cas d'échec, repli français. */
export function loadUiCatalog(l: Lang): Promise<void> {
  const c = catLang(l);
  if (!c || CATS[c]) return Promise.resolve();
  const imp =
    c === 'en'
      ? import('./ui-cat/en')
      : c === 'ar'
        ? import('./ui-cat/ar')
        : import('./ui-cat/de');
  return (pending[c] ??= imp
    .then((m) => {
      CATS[c] = m.CAT;
    })
    .catch(() => {
      delete pending[c];
    }));
}
export const uiCatalogLoaded = (l: Lang) => {
  const c = catLang(l);
  return !c || !!CATS[c];
};
/** true quand le catalogue de la langue est prêt (ou après 4 s : repli français plutôt qu'un écran vide). */
export function useUiCatalog(l: Lang): boolean {
  const [, tick] = useState(0);
  const [late, setLate] = useState(false);
  const ok = uiCatalogLoaded(l);
  useEffect(() => {
    if (ok) return;
    let live = true;
    void loadUiCatalog(l).then(() => live && tick((n) => n + 1));
    const id = setTimeout(() => live && setLate(true), 4000);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [l, ok]);
  return ok || late;
}

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

/** Catalogues chargés à la demande (ex. module bien-être) : fusionnés à la consultation. */
const EXTRA: Record<string, [en: string, ar: string, de?: string]> = {};
export function registerUiStrings(d: Record<string, [en: string, ar: string, de?: string]>) {
  Object.assign(EXTRA, d);
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const fill = (s: string, vars?: Record<string, string | number | null | undefined>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? "") : m)) : s);

function fromUiStrings(fr: string, c: CatLang): string | null {
  if (c === 'de') return null;
  const e = UI_STRINGS[fr] ?? UI_STRINGS[norm(fr)];
  if (!e) return null;
  return c === 'en' ? e[0] : e[1];
}

/** Cherche la traduction d'une chaîne française (null si absente du catalogue ou langue sans catalogue). */
export function lookup(fr: string, lang: Lang = cur): string | null {
  const c = catLang(lang);
  if (!c) return null;
  const m = CATS[c];
  let r = m?.[fr] ?? m?.[norm(fr)] ?? null;
  if (r == null) {
    const e = EXTRA[fr] ?? EXTRA[norm(fr)];
    r = e ? (c === 'en' ? e[0] : c === 'ar' ? e[1] : e[2] || null) : null;
  }
  if (r == null) r = fromUiStrings(fr, c);
  // Suisse alémanique : pas de « ß » (orthographe suisse).
  return r != null && lang === 'de-CH' ? r.replace(/ß/g, 'ss') : r;
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
  if (!catLang(lang)) return s;
  const t = s.trim();
  if (!t) return s;
  const r = lookup(t, lang);
  if (r == null) return s;
  const lead = s.slice(0, s.indexOf(t[0]));
  const trail = s.slice(s.lastIndexOf(t[t.length - 1]) + 1);
  return lead + r + trail;
}
