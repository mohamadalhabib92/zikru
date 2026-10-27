/**
 * CALENDRIER HÉGIRIEN — SOURCE DE VÉRITÉ UNIQUE (Phase 1, point 1).
 *
 * Tous les écrans affichent la date hégirienne via `toHijri()` / `formatHijri()` de ce module,
 * jamais via Intl ni un autre calcul (Intl « islamic » n'est pas fiable sous Hermes).
 *
 * Méthode : calendrier hégirien tabulaire (arithmétique, époque « civile » du vendredi
 * 16 juillet 622 julien = JDN 1948440), cycle de 30 ans avec 11 années abondantes
 * (années où (14 + 11·a) mod 30 < 11). Mois impairs = 30 j, mois pairs = 29 j,
 * Dhou al-Hijja = 30 j les années abondantes.
 *
 * Limite assumée : le calendrier tabulaire peut différer de ±1–2 jours de l'observation
 * du croissant ou d'Umm al-Qura. L'utilisateur peut appliquer un décalage (−2…+2 j)
 * dans Réglages ; le décalage est pris en compte partout (une seule fonction).
 * Le jour hégirien est ici le jour civil (minuit → minuit), pas le coucher du soleil.
 */

export type HijriDate = { year: number; month: number; day: number };

const EPOCH = 1948440; // JDN du 1 Muharram 1 AH (civil)

/** JDN (jour julien à midi) d'une date grégorienne proléptique. */
export function gregorianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return { day: e - Math.floor((153 * m + 2) / 5) + 1, month: m + 3 - 12 * Math.floor(m / 10), year: 100 * b + d - 4800 + Math.floor(m / 10) };
}

export function isHijriLeapYear(year: number): boolean {
  return (((14 + 11 * year) % 30) + 30) % 30 < 11;
}

export function daysInHijriMonth(year: number, month: number): number {
  if (month === 12) return isHijriLeapYear(year) ? 30 : 29;
  return month % 2 === 1 ? 30 : 29;
}

export function hijriToJdn(year: number, month: number, day: number): number {
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + EPOCH - 1;
}

export function jdnToHijri(jdn: number): HijriDate {
  const year = Math.floor((30 * (jdn - EPOCH) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((jdn - (29 + hijriToJdn(year, 1, 1))) / 29.5) + 1);
  const day = jdn - hijriToJdn(year, month, 1) + 1;
  return { year, month, day };
}

/** Date JS (jour civil local) → date hégirienne, avec décalage utilisateur en jours. */
export function toHijri(date: Date, offsetDays = 0): HijriDate {
  return jdnToHijri(gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate()) + offsetDays);
}

export function hijriToDate(h: HijriDate, offsetDays = 0): Date {
  const g = jdnToGregorian(hijriToJdn(h.year, h.month, h.day) - offsetDays);
  return new Date(g.year, g.month - 1, g.day, 12);
}

export const HIJRI_MONTHS: Record<'ar' | 'translit', string[]> = {
  ar: ['مُحَرَّم', 'صَفَر', 'رَبِيع ٱلْأَوَّل', 'رَبِيع ٱلْآخِر', 'جُمَادَىٰ ٱلْأُولَىٰ', 'جُمَادَىٰ ٱلْآخِرَة', 'رَجَب', 'شَعْبَان', 'رَمَضَان', 'شَوَّال', 'ذُو ٱلْقَعْدَة', 'ذُو ٱلْحِجَّة'],
  translit: ['Muharram', 'Safar', 'Rabi‘ al-awwal', 'Rabi‘ al-akhir', 'Joumada al-oula', 'Joumada al-akhira', 'Rajab', 'Cha‘ban', 'Ramadan', 'Chawwal', 'Dhou al-Qi‘da', 'Dhou al-Hijja'],
};

/** Affichage unique de la date hégirienne (utilisé par tous les écrans). */
export function formatHijri(date: Date, lang: string, offsetDays = 0): string {
  const h = toHijri(date, offsetDays);
  if (lang === 'ar') return `${h.day} ${HIJRI_MONTHS.ar[h.month - 1]} ${h.year} هـ`;
  return `${h.day} ${HIJRI_MONTHS.translit[h.month - 1]} ${h.year} AH`;
}

/** Auto-tests (dates limites). Exécutés par `npm test` et affichés dans Sources & Méthodologie. */
export function runHijriSelfTests(): { name: string; ok: boolean }[] {
  const out: { name: string; ok: boolean }[] = [];
  const t = (name: string, ok: boolean) => out.push({ name, ok });
  t('Époque : 1 Muharram 1 AH = 19 juillet 622 (grégorien proléptique)', (() => { const g = jdnToGregorian(EPOCH); return g.year === 622 && g.month === 7 && g.day === 19; })());
  t('Cycle de 30 ans = 10 631 jours', hijriToJdn(31, 1, 1) - hijriToJdn(1, 1, 1) === 10631);
  t('11 années abondantes par cycle', Array.from({ length: 30 }, (_, i) => i + 1).filter(isHijriLeapYear).length === 11);
  t('Mois impairs 30 j / pairs 29 j', [1, 3, 5, 7, 9, 11].every((m) => daysInHijriMonth(1446, m) === 30) && [2, 4, 6, 8, 10].every((m) => daysInHijriMonth(1446, m) === 29));
  t('Dhou al-Hijja = 30 j les années abondantes, 29 j sinon', daysInHijriMonth(1445, 12) === (isHijriLeapYear(1445) ? 30 : 29) && hijriToJdn(1446, 1, 1) - hijriToJdn(1445, 12, 1) === daysInHijriMonth(1445, 12));
  t('Passage 29 → 1 (mois de 29 jours)', (() => { const j = hijriToJdn(1446, 2, 29); const n = jdnToHijri(j + 1); return n.month === 3 && n.day === 1; })());
  t('Passage 30 → 1 (mois de 30 jours)', (() => { const j = hijriToJdn(1446, 1, 30); const n = jdnToHijri(j + 1); return n.month === 2 && n.day === 1; })());
  t('Passage d’année (Dhou al-Hijja → Muharram)', (() => { const j = hijriToJdn(1445, 12, daysInHijriMonth(1445, 12)); const n = jdnToHijri(j + 1); return n.year === 1446 && n.month === 1 && n.day === 1; })());
  t('Aller-retour grégorien ↔ hégirien sur 1300–1600 AH', (() => {
    for (let j = hijriToJdn(1300, 1, 1); j < hijriToJdn(1600, 1, 1); j += 7) {
      const h = jdnToHijri(j);
      if (hijriToJdn(h.year, h.month, h.day) !== j || h.day < 1 || h.day > daysInHijriMonth(h.year, h.month)) return false;
    }
    return true;
  })());
  t('Continuité jour par jour (aucun saut ni doublon) sur 1440–1460 AH', (() => {
    let prev = jdnToHijri(hijriToJdn(1440, 1, 1));
    for (let j = hijriToJdn(1440, 1, 1) + 1; j < hijriToJdn(1460, 1, 1); j++) {
      const h = jdnToHijri(j);
      const expected = prev.day < daysInHijriMonth(prev.year, prev.month) ? { ...prev, day: prev.day + 1 } : prev.month < 12 ? { year: prev.year, month: prev.month + 1, day: 1 } : { year: prev.year + 1, month: 1, day: 1 };
      if (h.year !== expected.year || h.month !== expected.month || h.day !== expected.day) return false;
      prev = h;
    }
    return true;
  })());
  t('Décalage utilisateur appliqué de façon cohérente', (() => { const d = new Date(2026, 9, 27, 12); const a = toHijri(d, 1); const b = toHijri(new Date(2026, 9, 28, 12), 0); return a.year === b.year && a.month === b.month && a.day === b.day; })());
  return out;
}
