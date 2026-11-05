/**
 * Catalogues d'interface chargés par `l10n.ts`.
 * en / ar restent dans `UI_STRINGS` (généré depuis i18n/*.tsv).
 * Ici : brouillons à relire (review). Aucun sens de Coran, du‘a, Nom, hadith ou fiqh.
 * de-CH réutilise `de` (ß → ss au moment de l'affichage).
 */
import type { Lang } from '../i18n';
import { cat as de } from './de';
import { cat as tr } from './tr';
import { cat as ur } from './ur';
import { cat as id } from './id';
import { cat as fa } from './fa';
import { cat as ha } from './ha';
import { cat as sw } from './sw';
import { cat as es } from './es';
import { cat as it } from './it';
import { cat as pt } from './pt';
import { cat as ff } from './ff';
import { cat as wo } from './wo';

const CATS: Partial<Record<Lang, Record<string, string>>> = { de, tr, ur, id, fa, ha, sw, es, it, pt, ff, wo };

export function uiCatalog(lang: string): Record<string, string> | null {
  return CATS[lang as Lang] ?? null;
}

export function uiCatalogText(lang: string, key: string): string | null {
  const v = CATS[lang as Lang]?.[key];
  return v && v.trim() ? v : null;
}
