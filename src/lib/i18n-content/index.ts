/**
 * Vues localisées du contenu religieux (P5). Le texte arabe source (Coran, hadith, du‘a) n’est JAMAIS modifié :
 * ces helpers ne choisissent que la langue des libellés et du SENS affiché à côté.
 * - fr : traduction française d’origine (relue) ;
 * - en : traduction anglaise (Pickthall pour le Coran ; sinon « traduction Zikru — à relire ») ;
 * - ar : aucun sens traduit (l’arabe source suffit) ; libellés en arabe standard moderne.
 * de / ff / wo : repli sur le français.
 */
import type { Lang } from '../i18n';
import type { Dua } from '../duas';
import type { QuranDua } from '../quran-duas';
import { DUAS_I18N } from './duas';
import { QURAN_DUAS_I18N } from './quran-duas';

export type ContentLang = 'fr' | 'en' | 'ar';
export const contentLang = (l: Lang): ContentLang => (l === 'en' ? 'en' : l === 'ar' ? 'ar' : 'fr');
const pick = (p: [string, string] | undefined, fr: string | undefined, cl: ContentLang) => (cl === 'fr' || !p ? fr : cl === 'en' ? p[0] : p[1]);

export type ContentView = {
  title: string;
  when?: string;
  /** Sens traduit à afficher sous l’arabe (absent en arabe). */
  meaning?: string;
  note?: string;
  /** Source / statut de la traduction affichée, ex. « traduction Zikru — à relire ». */
  translation?: string;
  toReview: boolean;
};

export function duaView(d: Dua, l: Lang): ContentView {
  const cl = contentLang(l);
  const t = DUAS_I18N[d.id];
  if (cl === 'fr' || !t) return { title: d.title, when: d.when, meaning: d.fr, note: d.note, toReview: false };
  return {
    title: pick(t.title, d.title, cl)!,
    when: d.when ? pick(t.when, d.when, cl) : undefined,
    meaning: cl === 'en' ? t.en : undefined,
    note: d.note ? pick(t.note, d.note, cl) : undefined,
    translation: cl === 'en' ? 'Zikru translation — under scholarly review' : undefined,
    toReview: cl === 'en',
  };
}

export function quranDuaView(q: QuranDua, l: Lang): ContentView {
  const cl = contentLang(l);
  const t = QURAN_DUAS_I18N[q.id];
  if (cl === 'fr' || !t) return { title: q.title, when: q.who, meaning: q.fr, translation: 'trad. Hamidullah', toReview: false };
  return {
    title: pick(t.title, q.title, cl)!,
    when: q.who ? pick(t.who, q.who, cl) : undefined,
    meaning: cl === 'en' ? q.en : undefined,
    translation: cl === 'en' ? 'transl. Pickthall (public domain)' : undefined,
    toReview: false,
  };
}

import type { FiqhRuling } from '../fiqh-rulings';
import { FIQH_AR, FIQH_EN, FIQH_TOPICS_I18N } from './fiqh';

export type RulingView = {
  title: string;
  /** Liste traduite (fr / en / ar). En arabe : résumé Zikru à relire (FIQH_AR) en plus de l’extrait classique `textAr`, recopié sans modification. */
  items?: string[];
  note?: string;
  toReview: boolean;
};
export function rulingView(r: FiqhRuling, l: Lang): RulingView {
  const cl = contentLang(l);
  if (cl === 'ar') {
    const a = FIQH_AR[r.id];
    return { title: r.title.ar ?? r.title.fr, items: a?.items, note: undefined, toReview: !!a };
  }
  const e = FIQH_EN[r.id];
  if (cl === 'en' && e) return { title: e.title, items: e.items, note: e.note, toReview: true };
  return { title: r.title.fr, items: r.items, note: r.note, toReview: false };
}
export function fiqhTopicTitle(id: string, fr: string, l: Lang): string {
  const cl = contentLang(l);
  const t = FIQH_TOPICS_I18N[id];
  return cl === 'fr' || !t ? fr : cl === 'en' ? t[0] : t[1];
}
export const schoolLabel = (s: { fr: string; en: string; ar: string }, l: Lang) => s[contentLang(l)];
