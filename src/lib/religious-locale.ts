/**
 * Langues du contenu religieux. Même liste que `LANGS` dans i18n.ts
 * (fr, en, de, de-CH, ar, tr, ur, id, fa, ha, sw, es, it, pt, ff, wo).
 * Le texte arabe vocalisé reste le matn. Une traduction n’est jamais présentée comme le matn.
 * Rien ici n’est « vérifié » : un savant doit relire.
 */

export const CONTENT_LOCALES = [
  'fr', 'en', 'de', 'de-CH', 'ar', 'tr', 'ur', 'id', 'fa', 'ha', 'sw', 'es', 'it', 'pt', 'ff', 'wo',
] as const;

export type ContentLocale = (typeof CONTENT_LOCALES)[number];

/** Statut du contenu lui-même (matn, attribut, explication). */
export const FLAG_SCHOLAR = 'à vérifier — validation par un savant requise';

/** Statut de la traduction dans une langue. */
export const FLAG_TRANSLATION = 'traduction à vérifier — relecture par un savant de cette langue requise';

export type SlotKind = 'matn' | 'published' | 'literal' | 'fallback';

export type LocaleSlot = {
  text: string;
  /** Édition, traducteur, ou « repli explicite vers … ». */
  source: string;
  kind: SlotKind;
  verified: false;
  flag: string;
  /** Présent seulement si kind === 'fallback'. */
  fallbackOf?: ContentLocale;
};

export type LocaleMap = Record<ContentLocale, LocaleSlot>;

const SPEECH: Record<ContentLocale, string> = {
  fr: 'fr-FR', en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH', ar: 'ar',
  tr: 'tr-TR', ur: 'ur-PK', id: 'id-ID', fa: 'fa-IR', ha: 'ha', sw: 'sw',
  es: 'es-ES', it: 'it-IT', pt: 'pt-PT', ff: 'ff', wo: 'wo',
};

const swiss = (s: string) => s.replace(/ß/g, 'ss');

export function buildLocales(
  partial: Partial<Record<ContentLocale, Omit<LocaleSlot, 'verified'>>>,
  fallback: ContentLocale = 'fr',
): LocaleMap {
  const out = {} as LocaleMap;
  for (const lang of CONTENT_LOCALES) {
    const own = partial[lang];
    if (own) {
      out[lang] = { ...own, verified: false };
      continue;
    }
    const via: ContentLocale = lang === 'de-CH' && partial.de ? 'de' : fallback;
    out[lang] = {
      text: '',
      source: `repli explicite vers ${via}`,
      kind: 'fallback',
      fallbackOf: via,
      verified: false,
      flag: FLAG_TRANSLATION,
    };
  }
  return out;
}

/** Texte effectivement affiché ou lu. Un repli ne paraphrase pas : il reprend le texte cité. */
export function resolveSlot(map: LocaleMap, lang: ContentLocale): LocaleSlot {
  const slot = map[lang];
  if (!slot) throw new Error('langue absente : ' + lang);
  if (slot.kind !== 'fallback' || !slot.fallbackOf) {
    return lang === 'de-CH' ? { ...slot, text: swiss(slot.text) } : slot;
  }
  const base = map[slot.fallbackOf];
  if (!base || base.kind === 'fallback') throw new Error('repli sans texte : ' + lang);
  const text = slot.fallbackOf === 'de' || lang === 'de-CH' ? swiss(base.text) : base.text;
  return { ...slot, text, verified: false };
}

/**
 * Ce que la lecture à voix haute prononce : le texte stocké de la langue,
 * ou le texte du repli explicite. Jamais une paraphrase produite à la volée.
 * La voix suit la langue du texte prononcé.
 */
export function spokenOf(map: LocaleMap, lang: ContentLocale): { text: string; speech: string; slot: LocaleSlot } {
  const slot = resolveSlot(map, lang);
  const voice = slot.kind === 'fallback' && slot.fallbackOf ? slot.fallbackOf : lang;
  return { text: slot.text, speech: SPEECH[voice], slot };
}
