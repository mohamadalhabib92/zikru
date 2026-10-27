/**
 * Interface en 7 langues : AR, EN, FR, DE, de-CH, Pulaar (ff), Wolof (wo).
 * - Ces chaînes sont l'INTERFACE (boutons, titres), jamais des traductions religieuses.
 * - Les traductions de textes religieux viennent exclusivement du workflow de contenu
 *   (statut « approved »), cf. src/lib/content.ts.
 * - Pulaar et Wolof : aucune traduction validée n'est disponible → repli explicite sur le
 *   français avec la mention « traduction en attente de validation » (rien n'est inventé).
 * - de-CH : allemand standard suisse (« ss » au lieu de « ß »).
 */
export type Lang = 'fr' | 'en' | 'de' | 'de-CH' | 'ar' | 'ff' | 'wo';

export const LANGS: { code: Lang; label: string; pending?: boolean }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'de-CH', label: 'Deutsch (Schweiz)' },
  { code: 'ar', label: 'العربية' },
  { code: 'ff', label: 'Pulaar', pending: true },
  { code: 'wo', label: 'Wolof', pending: true },
];

const fr = {
  tab_prayers: 'Prières', tab_qibla: 'Qibla', tab_tasbih: 'Tasbih', tab_dhikr: 'Dhikr', tab_settings: 'Réglages',
  today: "Aujourd'hui", next_prayer: 'Prochaine prière', in: 'dans', now: 'En cours', past: 'Passée', upcoming: 'À venir', current: 'Actuelle',
  fajr: 'Fajr', sunrise: 'Lever du soleil', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
  location: 'Lieu', method: 'Méthode de calcul', madhab: 'Asr (madhab)', shafi: 'Standard (Shafi‘i, Maliki, Hanbali)', hanafi: 'Hanafi',
  use_gps: 'Utiliser ma position', choose_city: 'Choisir une ville', example_location: 'Lieu d’exemple — réglez votre ville',
  qibla_title: 'Direction de la Qibla', qibla_from_north: 'depuis le nord géographique', compass_live: 'Boussole active', compass_unavailable: 'Boussole indisponible : orientez-vous avec l’angle depuis le nord.',
  last_position: 'Dernière position connue', distance_kaaba: 'Distance jusqu’à la Kaaba',
  tasbih_title: 'Tasbih', tap_to_count: 'Touchez pour compter', reset: 'Réinitialiser', target: 'Objectif', save_session: 'Enregistrer la session', history: 'Historique', no_history: 'Aucune session enregistrée.', cycle_done: 'Objectif atteint',
  dhikr_title: 'Dhikr', source: 'Source', no_content: 'Aucun contenu approuvé pour le moment.', translation_pending: 'Traduction en attente de validation',
  settings_title: 'Réglages', language: 'Langue', hijri_offset: 'Ajustement hégirien (jours)', audio: 'Voix (adhan / Bilal)', play: 'Écouter', pause: 'Pause', audio_missing: 'Fichier audio non fourni : lecture désactivée (aucun crash).',
  sources_title: 'Sources & Méthodologie', ring: 'Compteur Bluetooth', simulation: 'Simulation', config_missing: 'Configuration manquante', content_admin: 'Workflow de contenu', audit: 'Audit (Phase 0)', reset_data: 'Effacer les données locales',
  onboarding_welcome: 'Bienvenue sur Zikru', onboarding_sub: 'Prière, qibla et dhikr — calme, hors-ligne, sans publicité.', continue: 'Continuer', start: 'Commencer',
  offline_ready: 'Fonctionne hors-ligne', cancel: 'Annuler', save: 'Enregistrer', close: 'Fermer',
};
export type Dict = typeof fr;

const en: Dict = {
  tab_prayers: 'Prayers', tab_qibla: 'Qibla', tab_tasbih: 'Tasbih', tab_dhikr: 'Dhikr', tab_settings: 'Settings',
  today: 'Today', next_prayer: 'Next prayer', in: 'in', now: 'Now', past: 'Past', upcoming: 'Upcoming', current: 'Current',
  fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
  location: 'Location', method: 'Calculation method', madhab: 'Asr (madhab)', shafi: 'Standard (Shafi‘i, Maliki, Hanbali)', hanafi: 'Hanafi',
  use_gps: 'Use my location', choose_city: 'Choose a city', example_location: 'Example location — set your city',
  qibla_title: 'Qibla direction', qibla_from_north: 'from true north', compass_live: 'Compass active', compass_unavailable: 'Compass unavailable: use the angle from north.',
  last_position: 'Last known position', distance_kaaba: 'Distance to the Kaaba',
  tasbih_title: 'Tasbih', tap_to_count: 'Tap to count', reset: 'Reset', target: 'Target', save_session: 'Save session', history: 'History', no_history: 'No saved session yet.', cycle_done: 'Target reached',
  dhikr_title: 'Dhikr', source: 'Source', no_content: 'No approved content yet.', translation_pending: 'Translation pending approval',
  settings_title: 'Settings', language: 'Language', hijri_offset: 'Hijri adjustment (days)', audio: 'Voice (adhan / Bilal)', play: 'Play', pause: 'Pause', audio_missing: 'Audio file not provided: playback disabled (no crash).',
  sources_title: 'Sources & Methodology', ring: 'Bluetooth counter', simulation: 'Simulation', config_missing: 'Missing configuration', content_admin: 'Content workflow', audit: 'Audit (Phase 0)', reset_data: 'Erase local data',
  onboarding_welcome: 'Welcome to Zikru', onboarding_sub: 'Prayer, qibla and dhikr — calm, offline, ad-free.', continue: 'Continue', start: 'Start',
  offline_ready: 'Works offline', cancel: 'Cancel', save: 'Save', close: 'Close',
};

const de: Dict = {
  tab_prayers: 'Gebete', tab_qibla: 'Qibla', tab_tasbih: 'Tasbih', tab_dhikr: 'Dhikr', tab_settings: 'Einstellungen',
  today: 'Heute', next_prayer: 'Nächstes Gebet', in: 'in', now: 'Jetzt', past: 'Vorbei', upcoming: 'Bevorstehend', current: 'Aktuell',
  fajr: 'Fajr', sunrise: 'Sonnenaufgang', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
  location: 'Ort', method: 'Berechnungsmethode', madhab: 'Asr (Madhab)', shafi: 'Standard (Schafiʿi, Maliki, Hanbali)', hanafi: 'Hanafi',
  use_gps: 'Meinen Standort verwenden', choose_city: 'Stadt wählen', example_location: 'Beispielort — bitte Stadt einstellen',
  qibla_title: 'Qibla-Richtung', qibla_from_north: 'von geografisch Nord', compass_live: 'Kompass aktiv', compass_unavailable: 'Kompass nicht verfügbar: Winkel ab Norden verwenden.',
  last_position: 'Letzte bekannte Position', distance_kaaba: 'Entfernung zur Kaaba',
  tasbih_title: 'Tasbih', tap_to_count: 'Tippen zum Zählen', reset: 'Zurücksetzen', target: 'Ziel', save_session: 'Sitzung speichern', history: 'Verlauf', no_history: 'Noch keine Sitzung gespeichert.', cycle_done: 'Ziel erreicht',
  dhikr_title: 'Dhikr', source: 'Quelle', no_content: 'Noch keine freigegebenen Inhalte.', translation_pending: 'Übersetzung wartet auf Freigabe',
  settings_title: 'Einstellungen', language: 'Sprache', hijri_offset: 'Hidschri-Anpassung (Tage)', audio: 'Stimme (Adhan / Bilal)', play: 'Abspielen', pause: 'Pause', audio_missing: 'Audiodatei fehlt: Wiedergabe deaktiviert (kein Absturz).',
  sources_title: 'Quellen & Methodik', ring: 'Bluetooth-Zähler', simulation: 'Simulation', config_missing: 'Fehlende Konfiguration', content_admin: 'Inhalts-Workflow', audit: 'Audit (Phase 0)', reset_data: 'Lokale Daten löschen',
  onboarding_welcome: 'Willkommen bei Zikru', onboarding_sub: 'Gebet, Qibla und Dhikr — ruhig, offline, werbefrei.', continue: 'Weiter', start: 'Los geht’s',
  offline_ready: 'Funktioniert offline', cancel: 'Abbrechen', save: 'Speichern', close: 'Schliessen',
};

const ar: Dict = {
  tab_prayers: 'الصلوات', tab_qibla: 'القبلة', tab_tasbih: 'التسبيح', tab_dhikr: 'الأذكار', tab_settings: 'الإعدادات',
  today: 'اليوم', next_prayer: 'الصلاة القادمة', in: 'بعد', now: 'الآن', past: 'مضت', upcoming: 'قادمة', current: 'الحالية',
  fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء',
  location: 'الموقع', method: 'طريقة الحساب', madhab: 'العصر (المذهب)', shafi: 'الجمهور (الشافعي، المالكي، الحنبلي)', hanafi: 'الحنفي',
  use_gps: 'استخدام موقعي', choose_city: 'اختيار مدينة', example_location: 'موقع افتراضي — اختر مدينتك',
  qibla_title: 'اتجاه القبلة', qibla_from_north: 'من الشمال الجغرافي', compass_live: 'البوصلة تعمل', compass_unavailable: 'البوصلة غير متاحة: استخدم الزاوية من الشمال.',
  last_position: 'آخر موقع معروف', distance_kaaba: 'المسافة إلى الكعبة',
  tasbih_title: 'التسبيح', tap_to_count: 'المس للعد', reset: 'إعادة', target: 'الهدف', save_session: 'حفظ الجلسة', history: 'السجل', no_history: 'لا توجد جلسات محفوظة.', cycle_done: 'تم بلوغ الهدف',
  dhikr_title: 'الأذكار', source: 'المصدر', no_content: 'لا يوجد محتوى معتمد بعد.', translation_pending: 'الترجمة بانتظار الاعتماد',
  settings_title: 'الإعدادات', language: 'اللغة', hijri_offset: 'تعديل التاريخ الهجري (أيام)', audio: 'الصوت (الأذان)', play: 'تشغيل', pause: 'إيقاف مؤقت', audio_missing: 'الملف الصوتي غير متوفر: التشغيل معطّل.',
  sources_title: 'المصادر والمنهجية', ring: 'عداد بلوتوث', simulation: 'محاكاة', config_missing: 'الإعداد ناقص', content_admin: 'سير عمل المحتوى', audit: 'التدقيق (المرحلة 0)', reset_data: 'مسح البيانات المحلية',
  onboarding_welcome: 'مرحبًا بك في ذكرُ', onboarding_sub: 'الصلاة والقبلة والذكر — بهدوء، دون اتصال، دون إعلانات.', continue: 'متابعة', start: 'ابدأ',
  offline_ready: 'يعمل دون اتصال', cancel: 'إلغاء', save: 'حفظ', close: 'إغلاق',
};

const deCH: Dict = Object.fromEntries(Object.entries(de).map(([k, v]) => [k, v.replace(/ß/g, 'ss')])) as Dict;

export const DICTS: Record<Lang, Dict> = { fr, en, de, 'de-CH': deCH, ar, ff: fr, wo: fr };
export const isRTL = (l: Lang) => l === 'ar';
export const isPending = (l: Lang) => !!LANGS.find((x) => x.code === l)?.pending;
