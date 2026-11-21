import { UI_LOCALE, type Lang } from './i18n';

/**
 * Locale des nombres et des dates d’interface.
 * Arabe, persan et ourdou gardent les chiffres occidentaux, comme les horaires (07:12, pas ٠٧:١٢).
 */
export function countLocale(lang: Lang): string {
  if (lang === 'ar' || lang === 'fa' || lang === 'ur') return 'en-GB';
  return UI_LOCALE[lang] ?? 'fr-CH';
}

export function formatCount(n: number, lang: Lang): string {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  try {
    return v.toLocaleString(countLocale(lang));
  } catch {
    return String(v);
  }
}

export function formatDate(d: Date, lang: Lang, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return d.toLocaleDateString(countLocale(lang), opts);
  } catch {
    return d.toDateString();
  }
}

export function formatDateTime(d: Date, lang: Lang): string {
  try {
    return d.toLocaleString(countLocale(lang), { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return d.toISOString();
  }
}

/** Période d’une session de tasbih, sans découper une chaîne locale (le format change avec la langue). */
export function formatSessionSpan(startIso: string | undefined, endIso: string, lang: Lang): string {
  const end = new Date(endIso);
  const start = startIso ? new Date(startIso) : null;
  const date = (d: Date) => formatDate(d, lang, { day: 'numeric', month: 'short' });
  const time = (d: Date) => {
    try {
      return d.toLocaleTimeString(countLocale(lang), { hour: '2-digit', minute: '2-digit' });
    } catch {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  };
  if (!start || Number.isNaN(start.getTime()) || start.getTime() === end.getTime()) return `${date(end)} ${time(end)}`;
  const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
  if (sameDay) return `${date(end)} ${time(start)} – ${time(end)}`;
  return `${date(start)} ${time(start)} – ${date(end)} ${time(end)}`;
}

/**
 * Points cardinaux de la boussole, dans l’ordre nord, est, sud, ouest.
 * Français, italien, espagnol, portugais : Ouest = O. Allemand : Ost = O, West = W.
 * Anglais et arabe : W (l’abréviation arabe de l’est et du nord se confond ; les mots restent dans la phrase « tournez »).
 */
export function compassPoints(lang: Lang): readonly [string, string, string, string] {
  if (lang === 'de' || lang === 'de-CH') return ['N', 'O', 'S', 'W'];
  if (lang === 'fr' || lang === 'it' || lang === 'es' || lang === 'pt' || lang === 'ff' || lang === 'wo') return ['N', 'E', 'S', 'O'];
  return ['N', 'E', 'S', 'W'];
}
