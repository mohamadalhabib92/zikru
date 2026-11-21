import { registerUiStrings } from './l10n';

/** Textes du salon seulement. Chargés par les écrans tvOS. */
export const UI_STRINGS_TV: Record<string, [en: string, ar: string, de: string]> = {
  'Compteur de ce téléviseur, sans compte. Rejoindre une famille reste possible, et facultatif.': [
    'This TV’s counter, with no account. Joining a family stays possible, and optional.',
    'عدّاد هذا التلفاز، دون حساب. الانضمام إلى عائلة يبقى ممكنًا واختياريًا.',
    'Zähler dieses Fernsehers, ohne Konto. Einer Familie beizutreten bleibt möglich und freiwillig.',
  ],
  'La discussion familiale demande un compte. Le Coran, les horaires et le compteur restent ouverts.': [
    'Family chat needs an account. The Quran, prayer times and the counter stay open.',
    'محادثة العائلة تحتاج حسابًا. القرآن والمواقيت والعدّاد تبقى مفتوحة.',
    'Der Familienchat braucht ein Konto. Koran, Gebetszeiten und der Zähler bleiben offen.',
  ],
  'Le code de famille demande un compte. Le reste du salon s’ouvre sans connexion.': [
    'A family code needs an account. The rest of the living room opens with no sign-in.',
    'رمز العائلة يحتاج حسابًا. بقية الصالة تُفتح دون تسجيل دخول.',
    'Ein Familiencode braucht ein Konto. Der Rest des Wohnzimmers öffnet sich ohne Anmeldung.',
  ],
};

registerUiStrings(UI_STRINGS_TV);
