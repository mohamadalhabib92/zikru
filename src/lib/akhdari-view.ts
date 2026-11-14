/** Lecture du matn d’al-Akhdarī. Ne modifie jamais le texte des paragraphes. */

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
