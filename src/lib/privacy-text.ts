import { policyLang, type PolicyLang } from './privacy';

/** Textes des écrans de consentement et de la section « Confidentialité » (fr / en / ar). */
export type PrivacyText = {
  section: string;
  ai_title: string;
  ai_intro: string;
  ai_points: string[];
  ai_accept: string;
  ai_decline: string;
  ai_toggle: string;
  ai_off_note: string;
  weather_title: string;
  weather_text: string;
  weather_accept: string;
  weather_decline: string;
  weather_toggle: string;
  weather_off: string;
  location_note: string;
  account_check: string;
  account_required: string;
  policy_link: string;
  delete_account: string;
  delete_account_hint: string;
  clear_bilal: string;
  on: string;
  off: string;
  local_footer: string;
};

const fr: PrivacyText = {
  section: 'Confidentialité',
  ai_title: 'Avant de parler avec Bilal',
  ai_intro: 'Bilal est un assistant d’intelligence artificielle. Pour vous répondre, vos messages doivent quitter votre téléphone.',
  ai_points: [
    'Envoyé : vos messages et les 12 derniers échanges de la conversation. Votre identifiant de compte sert seulement au quota journalier sur notre serveur et n’est pas transmis au fournisseur d’IA.',
    'Destinataire : notre serveur Supabase à Zurich (Suisse), qui transmet le texte au fournisseur d’IA Anthropic PBC (Claude), aux États-Unis.',
    'Zikru n’enregistre pas vos messages sur ses serveurs (seulement un compteur d’utilisation). Anthropic les supprime en principe sous 30 jours et ne les utilise pas pour entraîner ses modèles.',
    'La conversation reste enregistrée sur votre appareil ; vous pouvez l’effacer à tout moment.',
    'N’indiquez pas de données de santé, d’adresse ou d’informations permettant de vous identifier. Bilal n’est ni un savant ni un médecin.',
    'Vous pouvez retirer ce consentement à tout moment dans Réglages › Confidentialité.',
  ],
  ai_accept: 'J’accepte, continuer',
  ai_decline: 'Pas maintenant',
  ai_toggle: 'Bilal (IA) — envoi des messages',
  ai_off_note: 'Sans consentement, la réflexion du jour vient de la sélection locale de Zikru.',
  weather_title: 'Afficher la météo ?',
  weather_text: 'Pour la météo, une position arrondie à ~10 km est envoyée à Open-Meteo (Suisse). Les horaires de prière et la qibla restent calculés sur votre appareil.',
  weather_accept: 'Activer la météo',
  weather_decline: 'Non merci',
  weather_toggle: 'Météo (position arrondie ~10 km)',
  weather_off: 'Météo désactivée — activable dans Réglages › Confidentialité.',
  location_note: 'Votre position reste sur l’appareil : horaires et qibla sont calculés localement. Vous pouvez aussi choisir une ville sans activer la localisation.',
  account_check: 'J’accepte que mon e-mail, mon nom affiché et mes données de famille et de cercles (qui peuvent révéler ma pratique religieuse) soient stockés chez Supabase à Zurich pour faire fonctionner la communauté. Je peux supprimer mon compte à tout moment.',
  account_required: 'Cochez la case pour créer ou utiliser un compte.',
  policy_link: 'Politique de confidentialité',
  delete_account: 'Supprimer mon compte',
  delete_account_hint: 'Communauté › Supprimer mon compte (effacement définitif sur le serveur).',
  clear_bilal: 'Effacer la conversation Bilal de cet appareil',
  on: 'Oui',
  off: 'Non',
  local_footer: 'Sans compte, vos données restent sur cet appareil. Aucune publicité, aucun pistage, aucune revente.',
};

const en: PrivacyText = {
  section: 'Privacy',
  ai_title: 'Before you talk with Bilal',
  ai_intro: 'Bilal is an artificial-intelligence assistant. To answer you, your messages have to leave your phone.',
  ai_points: [
    'Sent: your messages and the last 12 turns of the conversation. Your account ID is only used for the daily quota on our server and is not passed to the AI provider.',
    'Recipient: our Supabase server in Zurich (Switzerland), which forwards the text to the AI provider Anthropic PBC (Claude), in the United States.',
    'Zikru does not store your messages on its servers (only a usage counter). Anthropic normally deletes them within 30 days and does not use them to train its models.',
    'The conversation stays saved on your device; you can erase it at any time.',
    'Do not share health data, your address or anything that identifies you. Bilal is neither a scholar nor a doctor.',
    'You can withdraw this consent at any time in Settings › Privacy.',
  ],
  ai_accept: 'I agree, continue',
  ai_decline: 'Not now',
  ai_toggle: 'Bilal (AI) — sending messages',
  ai_off_note: 'Without consent, the daily reflection comes from Zikru’s built-in selection.',
  weather_title: 'Show the weather?',
  weather_text: 'For the weather, a position rounded to ~10 km is sent to Open-Meteo (Switzerland). Prayer times and the qibla are still computed on your device.',
  weather_accept: 'Turn on weather',
  weather_decline: 'No thanks',
  weather_toggle: 'Weather (position rounded ~10 km)',
  weather_off: 'Weather off — you can turn it on in Settings › Privacy.',
  location_note: 'Your location stays on the device: prayer times and qibla are computed locally. You can also pick a city without turning on location.',
  account_check: 'I agree that my email, display name and family and circle data (which may reveal my religious practice) are stored with Supabase in Zurich to run the community features. I can delete my account at any time.',
  account_required: 'Tick the box to create or use an account.',
  policy_link: 'Privacy policy',
  delete_account: 'Delete my account',
  delete_account_hint: 'Community › Delete my account (permanent deletion on the server).',
  clear_bilal: 'Erase the Bilal conversation from this device',
  on: 'Yes',
  off: 'No',
  local_footer: 'Without an account, your data stays on this device. No ads, no tracking, no resale.',
};

const ar: PrivacyText = {
  section: 'الخصوصية',
  ai_title: 'قبل التحدث مع بلال',
  ai_intro: 'بلال مساعد يعمل بالذكاء الاصطناعي. لكي يجيبك، يجب أن تُرسَل رسائلك خارج هاتفك.',
  ai_points: [
    'ما يُرسَل: رسائلك وآخر 12 رسالة من المحادثة. أما معرّف حسابك فيُستعمل فقط لحساب الحصة اليومية على خادمنا ولا يُنقَل إلى مزوّد الذكاء الاصطناعي.',
    'إلى من: خادمنا لدى Supabase في زيورخ (سويسرا)، الذي ينقل النص إلى مزوّد الذكاء الاصطناعي Anthropic PBC (Claude) في الولايات المتحدة.',
    'لا يحفظ ذكرو رسائلك على خوادمه (سوى عدّاد للاستخدام). وتحذفها Anthropic عادةً خلال 30 يومًا ولا تستعملها لتدريب نماذجها.',
    'تبقى المحادثة محفوظة على جهازك، ويمكنك مسحها في أي وقت.',
    'لا تذكر بيانات صحية أو عنوانك أو ما يدلّ على هويتك. بلال ليس عالِمًا ولا طبيبًا.',
    'يمكنك سحب هذه الموافقة في أي وقت من الإعدادات › الخصوصية.',
  ],
  ai_accept: 'أوافق، متابعة',
  ai_decline: 'ليس الآن',
  ai_toggle: 'بلال (ذكاء اصطناعي) — إرسال الرسائل',
  ai_off_note: 'بدون موافقة، تأتي خاطرة اليوم من مجموعة ذكرو المحلية.',
  weather_title: 'عرض حالة الطقس؟',
  weather_text: 'لعرض الطقس، يُرسَل موقع تقريبي (حوالي 10 كم) إلى Open-Meteo (سويسرا). أما مواقيت الصلاة والقبلة فتُحسَب على جهازك.',
  weather_accept: 'تفعيل الطقس',
  weather_decline: 'لا، شكرًا',
  weather_toggle: 'الطقس (موقع تقريبي ~10 كم)',
  weather_off: 'الطقس متوقف — يمكن تفعيله من الإعدادات › الخصوصية.',
  location_note: 'يبقى موقعك على الجهاز: تُحسَب المواقيت والقبلة محليًا. ويمكنك أيضًا اختيار مدينة دون تفعيل تحديد الموقع.',
  account_check: 'أوافق على حفظ بريدي الإلكتروني واسمي الظاهر وبيانات العائلة والحلقات (التي قد تكشف ممارستي الدينية) لدى Supabase في زيورخ لتشغيل ميزات المجتمع. ويمكنني حذف حسابي في أي وقت.',
  account_required: 'ضع علامة في المربع لإنشاء حساب أو استخدامه.',
  policy_link: 'سياسة الخصوصية',
  delete_account: 'حذف حسابي',
  delete_account_hint: 'المجتمع › حذف حسابي (حذف نهائي من الخادم).',
  clear_bilal: 'مسح محادثة بلال من هذا الجهاز',
  on: 'نعم',
  off: 'لا',
  local_footer: 'بدون حساب، تبقى بياناتك على هذا الجهاز. لا إعلانات ولا تتبّع ولا بيع للبيانات.',
};

export const PRIVACY_TEXT: Record<PolicyLang, PrivacyText> = { fr, en, ar };

export function privacyText(lang: string): PrivacyText {
  return PRIVACY_TEXT[policyLang(lang)];
}
