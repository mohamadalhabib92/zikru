/**
 * Lecture du matn d’al-Akhdarī. Ne modifie jamais le texte des paragraphes.
 * Chaque langue de l’app a une entrée : l’arabe est le matn ; les autres langues
 * replient explicitement sur ce matn, avec le drapeau de traduction.
 * Aucune paraphrase n’est produite à la lecture.
 */
import { buildLocales, FLAG_SCHOLAR, FLAG_TRANSLATION, type LocaleMap } from './religious-locale';

export type AkhdariItem = {
  id: string;
  page: number;
  heading: string | null;
  text: string;
  kind: string;
  chapter?: string;
  subheading?: string | null;
};

export const AKHDARI_AUTHOR = 'Abū Zayd ʿAbd al-Raḥmān al-Akhdarī';
export const AKHDARI_JSON_SHA256 = '65948bd45d3aa9c05021b6f378198e365f174feeadf50fa40e4f27055f02dc92';

export type AkhdariChapter = {
  title: string;
  start: number;
  subs: { title: string; index: number }[];
};

export function akhdariChapters(items: readonly AkhdariItem[]): AkhdariChapter[] {
  const out: AkhdariChapter[] = [];
  items.forEach((item, index) => {
    if (item.kind !== 'paragraph' || !item.chapter) return;
    let ch = out[out.length - 1];
    if (!ch || ch.title !== item.chapter) {
      ch = { title: item.chapter, start: index, subs: [] };
      out.push(ch);
    }
    if (item.subheading && ch.subs[ch.subs.length - 1]?.title !== item.subheading) ch.subs.push({ title: item.subheading, index });
  });
  return out;
}

export function chapterParagraphs(items: readonly AkhdariItem[], title: string): AkhdariItem[] {
  return items.filter((item) => item.kind === 'paragraph' && item.chapter === title);
}

/** Découpe une phrase parlée. La ponctuation reste collée à la phrase. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const ch of text) {
    buf += ch;
    if (ch === '.' || ch === '!' || ch === '?' || ch === '؟') {
      const t = buf.trim();
      if (t) out.push(t);
      buf = '';
    }
  }
  const rest = buf.trim();
  if (rest) out.push(rest);
  return out.length ? out : [text];
}

export const AKHDARI_EDITION_SOURCE =
  'Édition vocalisée fournie par Mohamed El Habib Ba. Texte classique d’Abū Zayd ʿAbd al-Raḥmān al-Akhdarī, domaine public. Fichier recopié tel quel.';

/** Le paragraphe reste le matn arabe dans chaque langue. Pas de traduction inventée. */
export function akhdariParagraphLocales(text: string): LocaleMap {
  return buildLocales({
    ar: { text, source: AKHDARI_EDITION_SOURCE, kind: 'matn', flag: FLAG_SCHOLAR },
  }, 'ar');
}

/**
 * Avertissement stocké, distinct du matn : aucune traduction de paragraphe n’est jointe.
 * ff, wo et de-CH replient (de-CH sur l’allemand).
 */
export const AKHDARI_GAP: LocaleMap = buildLocales({
  fr: {
    text: 'Aucune traduction de ce paragraphe, distincte du matn, n’est jointe. Le texte lu est le matn arabe, non modifié.',
    source: 'Mention Zikru, pas une traduction du matn.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  en: {
    text: 'No translation of this paragraph, separate from the matn, is included. What is read aloud is the Arabic matn, unchanged.',
    source: 'Zikru notice, not a translation of the matn.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  de: {
    text: 'Keine vom matn verschiedene Übersetzung dieses Absatzes liegt bei. Vorgelesen wird der arabische matn, unverändert.',
    source: 'Hinweis von Zikru, keine Übersetzung des matn.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  ar: {
    text: 'لا ترجمة لهذه الفقرة غير المتن. المقروء هو المتن العربي كما هو.',
    source: 'تنبيه من التطبيق، وليس ترجمة للمتن.',
    kind: 'literal',
    flag: FLAG_SCHOLAR,
  },
  es: {
    text: 'No hay una traducción de este párrafo distinta del matn. Lo que se lee es el matn árabe, sin cambio.',
    source: 'Aviso de Zikru, no una traducción del matn.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  it: {
    text: 'Non c’è una traduzione di questo capoverso distinta dal matn. Si legge il matn arabo, invariato.',
    source: 'Avviso di Zikru, non una traduzione del matn.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  pt: {
    text: 'Não há tradução deste parágrafo distinta do matn. Lê-se o matn árabe, sem alteração.',
    source: 'Aviso da Zikru, não uma tradução do matn.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  tr: {
    text: 'Bu paragrafın metinden ayrı bir çevirisi yok. Okunan, değiştirilmemiş Arapça metindir.',
    source: 'Zikru uyarısı, metnin çevirisi değil.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  id: {
    text: 'Tidak ada terjemahan ayat ini yang terpisah dari matn. Yang dibaca adalah matn Arab, tanpa diubah.',
    source: 'Pemberitahuan Zikru, bukan terjemahan matn.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  ur: {
    text: 'اس پیراگراف کا متن سے الگ ترجمہ شامل نہیں۔ جو پڑھا جاتا ہے وہ عربی متن ہے، بغیر تبدیلی۔',
    source: 'ایپ کا تنبیہ، متن کا ترجمہ نہیں۔',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  fa: {
    text: 'ترجمهٔ این بند، جدا از متن، نیامده است. آنچه خوانده می‌شود متن عربی است، بی‌تغییر.',
    source: 'یادداشت زیکرو، نه ترجمهٔ متن.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  ha: {
    text: 'Babu fassarar wannan sakin layi dabam da matn. Ana karanta matn Larabci, ba a canza shi ba.',
    source: 'Sanarwar Zikru, ba fassarar matn ba.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
  sw: {
    text: 'Hakuna tafsiri ya aya hii tofauti na matn. Kinachosomwa ni matn ya Kiarabu, bila kubadilishwa.',
    source: 'Taarifa ya Zikru, si tafsiri ya matn.',
    kind: 'literal',
    flag: FLAG_TRANSLATION,
  },
});
