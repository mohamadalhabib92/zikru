import type { PolicyLang } from './privacy';

/**
 * Politique de confidentialité — SOURCE UNIQUE pour l'écran /privacy et la page publique
 * public/privacy/index.html (générée par `npm run privacy:html`, vérifiée par scripts/test-privacy.mjs).
 * Chaque flux de données décrit ici doit correspondre au code ; toute nouvelle connexion réseau
 * doit être ajoutée ici AVANT la mise en production.
 */
export type PolicySection = { id: string; h: string; p?: string[]; li?: string[] };
export type Policy = { title: string; updated: string; lead: string; sections: PolicySection[]; prevails?: string };

export const POLICY_UPDATED = '2026-10-29';
export const CONTROLLER = 'Mohamed El Habib Ba, Chemin de la Suettaz 17, 1008 Prilly, Suisse';

const fr: Policy = {
  title: 'Politique de confidentialité de Zikru',
  updated: 'Dernière mise à jour : 30 octobre 2026 (version 1.0.24)',
  lead: 'Zikru fonctionne sans compte et sans publicité. Sans compte, vos compteurs, réglages et lectures restent sur votre appareil. Certaines fonctions facultatives envoient des données à des serveurs : elles sont décrites ci-dessous, une par une, et les plus sensibles ne s’activent qu’avec votre accord explicite.',
  sections: [
    {
      id: 'controller',
      h: '1. Responsable du traitement',
      p: [
        `${CONTROLLER}.`,
        'Une société Zikru est en cours de création ; lorsqu’elle reprendra l’application, cette politique sera mise à jour et vous en serez informé dans l’app.',
        'Contact pour toute question ou demande liée à vos données (accès, rectification, suppression, opposition) : par e-mail à mohamadalhabib@live.com, par courrier à l’adresse ci-dessus, ou via la page d’assistance https://mohamadalhabib92.github.io/zikru/support/ (n’y publiez pas de données personnelles : nous vous recontacterons en privé).',
      ],
    },
    {
      id: 'local',
      h: '2. Ce qui reste sur votre appareil',
      li: [
        'Compteurs de dhikr, wird, objectifs, historique de lecture, favoris, mémorisation, réglages, lieu choisi : stockés uniquement sur l’appareil (ou dans le navigateur pour la version web).',
        'Horaires de prière, qibla et calendrier hégirien : calculés sur l’appareil, sans connexion.',
        'Conversation avec Bilal : enregistrée sur l’appareil (40 derniers messages), effaçable à tout moment.',
        'Notifications : programmées localement par votre téléphone ; Zikru n’utilise aucun serveur de notifications push.',
        'Bluetooth : Zikru se connecte seulement au tasbih / à l’anneau que vous choisissez, pour lire les pressions du compteur. L’identifiant de l’appareil est mémorisé sur le téléphone. Le Bluetooth n’est pas utilisé pour vous localiser.',
      ],
    },
    {
      id: 'location',
      h: '3. Localisation et météo',
      li: [
        'La localisation est facultative : vous pouvez choisir une ville à la place. Si vous l’autorisez, la position est lue au premier plan seulement, arrondie (~100 m) et conservée sur l’appareil pour les horaires et la qibla.',
        'Météo (désactivée tant que vous ne l’activez pas) : une position arrondie au dixième de degré (~10 km) est envoyée à Open-Meteo (OpenMeteo GmbH, Bürglen, Suisse ; serveurs en Europe et en Amérique du Nord). Selon Open-Meteo, ses journaux techniques (adresse IP, coordonnées) sont supprimés après 90 jours.',
        'Le nom de la ville est déterminé sur l’appareil ; aucune position n’est envoyée à un service de géocodage.',
        'La position n’est jamais utilisée pour la publicité ni pour le pistage, et n’est jamais liée à votre compte.',
      ],
    },
    {
      id: 'account',
      h: '4. Compte Communauté (facultatif)',
      p: ['Le compte ne sert qu’aux fonctions Famille, Cercles et Bilal. Vous le créez avec votre adresse e-mail (code à usage unique, sans mot de passe), après avoir coché votre accord.'],
      li: [
        'Données : adresse e-mail ; nom affiché (par défaut, la partie de l’e-mail avant « @ », modifiable) ; identifiant de compte ; indicateur « profil enfant » géré par le serveur ; familles et cercles dont vous êtes membre, invitations ; messages d’encouragement que vous envoyez ; sessions et compteurs de dhikr partagés, objectifs communs, événements du calendrier familial, préférences de partage.',
        'Ces données peuvent révéler votre pratique religieuse : ce sont des données sensibles (art. 5 let. c nLPD, art. 9 RGPD). Nous ne les traitons qu’avec votre consentement explicite, pour faire fonctionner ces fonctions, et seuls les membres que vous rejoignez y ont accès (règles d’accès au niveau de la base de données).',
        'Hébergement : Supabase (Supabase Inc., États-Unis, sous-traitant), base de données hébergée à Zurich (Suisse, région eu-central-2). L’e-mail de connexion est envoyé par le service d’authentification de Supabase.',
        'Votre session de connexion est conservée sur l’appareil pour vous éviter de vous reconnecter ; elle est effacée à la déconnexion.',
        'Messages d’encouragement et sessions : chiffrés en transit et accessibles aux seuls membres concernés ; ils ne sont pas encore chiffrés de bout en bout (prévu). Les liens sont refusés et un filtre de base écarte les insultes graves. Un enfant n’échange par défaut qu’avec ses parents, et un parent peut tout couper.',
        'Sécurité et modération : vous pouvez signaler un contenu ou une personne et bloquer quelqu’un. Un signalement transmet à l’équipe Zikru une copie du contenu signalé, votre identifiant, le motif et votre précision ; la personne signalée n’en est pas informée. Des compteurs techniques limitent les abus (envois, invitations, essais de code). Contact modération : mohamadalhabib@live.com.',
      ],
    },
    {
      id: 'ai',
      h: '5. Bilal, l’assistant IA (facultatif)',
      li: [
        'Avant le premier message, Zikru vous demande votre consentement explicite ; vous pouvez le retirer dans Réglages › Confidentialité. Sans consentement, rien n’est envoyé et la réflexion du jour vient de la sélection locale.',
        'Envoyé : vos messages et les 12 derniers échanges de la conversation (ou, pour la réflexion du jour, seulement le moment de la journée). Ils passent par notre fonction serveur Supabase (Zurich) puis sont transmis au fournisseur d’IA Anthropic PBC (modèle Claude), aux États-Unis.',
        'Votre identifiant de compte sert uniquement au quota journalier (un compteur par jour) et n’est pas transmis à Anthropic. Zikru n’enregistre pas le contenu des messages sur ses serveurs.',
        'Selon Anthropic, les contenus reçus par son API sont supprimés en principe sous 30 jours (plus longtemps seulement en cas d’abus signalé ou d’obligation légale) et ne servent pas à entraîner ses modèles.',
        'Si nous changeons de fournisseur d’IA, cette politique sera mise à jour et votre consentement sera redemandé.',
        'N’indiquez pas de données de santé ou d’informations permettant de vous identifier. Bilal n’est ni un savant ni un médecin.',
      ],
    },
    {
      id: 'content',
      h: '6. Contenus coraniques, audio et recherche',
      li: [
        'Le texte arabe du Coran est intégré à l’app. Certaines fonctions téléchargent des contenus à la demande : traductions et recherche (api.alquran.cloud), tafsir (api.quran.com), récitations audio (everyayah.com, cdn.islamic.network, mp3quran.net).',
        'Ces serveurs reçoivent, comme tout site web, votre adresse IP et l’élément demandé ; pour la recherche en ligne, le texte recherché. Aucun identifiant de compte ne leur est transmis.',
        'Le site web et la version web (PWA) sont hébergés par GitHub Pages (GitHub Inc., États-Unis), qui enregistre des journaux techniques (dont l’adresse IP) pour la sécurité.',
      ],
    },
    {
      id: 'never',
      h: '7. Ce que nous ne faisons jamais',
      li: [
        'Aucune publicité, aucun outil d’analyse ou de pistage, aucun profilage.',
        'Aucune vente, location ou cession de vos données.',
        'Aucun partage avec des tiers en dehors des prestataires techniques cités ici, qui n’agissent que pour faire fonctionner le service.',
      ],
    },
    {
      id: 'transfers',
      h: '8. Transferts à l’étranger',
      p: [
        'Les données du compte sont hébergées en Suisse. Supabase Inc. (États-Unis) peut y accéder en tant que sous-traitant, sur la base de ses garanties contractuelles (clauses contractuelles types). L’envoi des messages de Bilal aux États-Unis repose sur votre consentement explicite (art. 17 al. 1 let. a nLPD, art. 49 par. 1 let. a RGPD). La météo est traitée par un prestataire suisse.',
      ],
    },
    {
      id: 'retention',
      h: '9. Durées de conservation et suppression',
      li: [
        'Données locales : jusqu’à ce que vous les effaciez (Réglages › Réinitialiser) ou désinstalliez l’app.',
        'Compte : tant que vous le gardez. « Supprimer mon compte » (Communauté) efface immédiatement votre compte et les données qui y sont liées, ainsi que les familles dont vous êtes le seul parent. Les sauvegardes techniques de l’hébergeur sont écrasées selon son cycle de rotation.',
        'Quota Bilal : compteur journalier supprimé avec le compte.',
        'Communautés (suppression automatique chaque nuit) : messages d’encouragement après 365 jours ; sessions en direct terminées après 90 jours ; invitations expirées ou révoquées après 30 jours ; signalements 365 jours après leur traitement ; compteurs anti-abus après 2 jours.',
        'Prestataires : Open-Meteo, 90 jours pour les journaux ; Anthropic, en principe 30 jours.',
      ],
    },
    {
      id: 'children',
      h: '10. Enfants',
      p: ['Les profils enfants sont créés et gérés par un parent au sein d’une famille ; des restrictions s’appliquent à ces profils. Un enfant ne doit pas créer de compte ni utiliser Bilal sans l’accord d’un parent.'],
    },
    {
      id: 'rights',
      h: '11. Vos droits',
      li: [
        'Vous pouvez demander l’accès à vos données, leur rectification, leur effacement, leur portabilité, vous opposer à un traitement ou retirer un consentement à tout moment (sans effet sur la licéité passée).',
        'Effacement : directement dans l’app (Communauté › Supprimer mon compte). Consentements : Réglages › Confidentialité.',
        'Pour les autres demandes, écrivez à mohamadalhabib@live.com (section 1) ; nous répondons dans un délai de 30 jours.',
        'Vous pouvez porter plainte auprès du Préposé fédéral à la protection des données et à la transparence (PFPDT, www.edoeb.admin.ch) ou, dans l’Union européenne, auprès de l’autorité de contrôle de votre pays.',
      ],
    },
    {
      id: 'security',
      h: '12. Sécurité',
      p: ['Connexions chiffrées (HTTPS), connexion sans mot de passe, règles d’accès par utilisateur dans la base de données, codes d’invitation enregistrés sous forme hachée, aucune clé secrète dans l’application. Les messages ne sont pas encore chiffrés de bout en bout.'],
    },
    {
      id: 'changes',
      h: '13. Modifications',
      p: ['En cas de changement important (nouveau flux de données, nouveau prestataire), nous mettons à jour cette page et vous redemandons votre consentement lorsque c’est nécessaire.'],
    },
  ],
};

const en: Policy = {
  title: 'Zikru privacy policy',
  updated: 'Last updated: 30 October 2026 (version 1.0.24)',
  lead: 'Zikru works without an account and without ads. Without an account, your counters, settings and reading stay on your device. Some optional features send data to servers: each is described below, and the most sensitive ones only turn on with your explicit consent.',
  sections: [
    {
      id: 'controller',
      h: '1. Data controller',
      p: [
        `${CONTROLLER}.`,
        'A Zikru company is being set up; when it takes over the app, this policy will be updated and you will be told in the app.',
        'Contact for any question or request about your data (access, correction, deletion, objection): by email at mohamadalhabib@live.com, by post at the address above, or through the support page https://mohamadalhabib92.github.io/zikru/support/ (do not post personal data there: we will get back to you privately).',
      ],
    },
    {
      id: 'local',
      h: '2. What stays on your device',
      li: [
        'Dhikr counters, wird, goals, reading history, bookmarks, memorisation, settings, chosen place: stored only on the device (or in the browser for the web version).',
        'Prayer times, qibla and Hijri calendar: computed on the device, offline.',
        'Conversation with Bilal: saved on the device (last 40 messages), erasable at any time.',
        'Notifications: scheduled locally by your phone; Zikru uses no push-notification server.',
        'Bluetooth: Zikru only connects to the tasbih / ring you choose, to read counter presses. The device identifier is remembered on the phone. Bluetooth is not used to locate you.',
      ],
    },
    {
      id: 'location',
      h: '3. Location and weather',
      li: [
        'Location is optional: you can pick a city instead. If you allow it, the position is read in the foreground only, rounded (~100 m) and kept on the device for prayer times and qibla.',
        'Weather (off until you turn it on): a position rounded to a tenth of a degree (~10 km) is sent to Open-Meteo (OpenMeteo GmbH, Bürglen, Switzerland; servers in Europe and North America). According to Open-Meteo, its technical logs (IP address, coordinates) are deleted after 90 days.',
        'The city name is worked out on the device; no position is sent to a geocoding service.',
        'Location is never used for advertising or tracking and is never linked to your account.',
      ],
    },
    {
      id: 'account',
      h: '4. Community account (optional)',
      p: ['The account is only used for Family, Circles and Bilal. You create it with your email address (one-time code, no password), after ticking your consent.'],
      li: [
        'Data: email address; display name (by default the part of the email before “@”, editable); account ID; server-managed “child profile” flag; families and circles you belong to, invitations; encouragement messages you send; shared dhikr sessions and counters, shared goals, family calendar events, sharing preferences.',
        'This data may reveal your religious practice: it is sensitive data (Swiss FADP art. 5(c), GDPR art. 9). We only process it with your explicit consent, to run these features, and only the members you join can access it (database-level access rules).',
        'Hosting: Supabase (Supabase Inc., USA, processor), database hosted in Zurich (Switzerland, region eu-central-2). The sign-in email is sent by Supabase’s authentication service.',
        'Your sign-in session is kept on the device so you do not have to sign in again; it is erased when you sign out.',
        'Encouragement messages and sessions: encrypted in transit and accessible only to the members concerned; they are not yet end-to-end encrypted (planned). Links are refused and a basic filter blocks severe insults. By default a child only exchanges messages with their parents, and a parent can turn messaging off entirely.',
        'Safety and moderation: you can report content or a person and block someone. A report sends the Zikru team a copy of the reported content, your account ID, the reason and your note; the reported person is not told. Technical counters limit abuse (messages, invitations, code attempts). Moderation contact: mohamadalhabib@live.com.',
      ],
    },
    {
      id: 'ai',
      h: '5. Bilal, the AI assistant (optional)',
      li: [
        'Before the first message, Zikru asks for your explicit consent; you can withdraw it in Settings › Privacy. Without consent nothing is sent and the daily reflection comes from the built-in selection.',
        'Sent: your messages and the last 12 turns of the conversation (or, for the daily reflection, only the time of day). They go through our Supabase server function (Zurich) and are then forwarded to the AI provider Anthropic PBC (Claude model), in the United States.',
        'Your account ID is only used for the daily quota (one counter per day) and is not passed to Anthropic. Zikru does not store message content on its servers.',
        'According to Anthropic, content received by its API is normally deleted within 30 days (longer only for flagged abuse or legal obligations) and is not used to train its models.',
        'If we change AI provider, this policy will be updated and your consent asked again.',
        'Do not share health data or anything that identifies you. Bilal is neither a scholar nor a doctor.',
      ],
    },
    {
      id: 'content',
      h: '6. Quran content, audio and search',
      li: [
        'The Arabic Quran text is built into the app. Some features download content on demand: translations and search (api.alquran.cloud), tafsir (api.quran.com), audio recitations (everyayah.com, cdn.islamic.network, mp3quran.net).',
        'Like any website, these servers receive your IP address and the item requested; for online search, the search text. No account identifier is sent to them.',
        'The website and the web version (PWA) are hosted on GitHub Pages (GitHub Inc., USA), which keeps technical logs (including IP address) for security.',
      ],
    },
    {
      id: 'never',
      h: '7. What we never do',
      li: [
        'No advertising, no analytics or tracking tools, no profiling.',
        'No selling, renting or handing over of your data.',
        'No sharing with third parties other than the technical providers listed here, who only act to run the service.',
      ],
    },
    {
      id: 'transfers',
      h: '8. International transfers',
      p: [
        'Account data is hosted in Switzerland. Supabase Inc. (USA) may access it as a processor under its contractual safeguards (standard contractual clauses). Sending Bilal messages to the USA relies on your explicit consent (FADP art. 17(1)(a), GDPR art. 49(1)(a)). Weather is handled by a Swiss provider.',
      ],
    },
    {
      id: 'retention',
      h: '9. Retention and deletion',
      li: [
        'Local data: until you erase it (Settings › Reset) or uninstall the app.',
        'Account: as long as you keep it. “Delete my account” (Community) immediately erases your account and linked data, and families where you are the only parent. The host’s technical backups are overwritten on its rotation cycle.',
        'Bilal quota: daily counter deleted with the account.',
        'Communities (automatic deletion every night): encouragement messages after 365 days; ended live sessions after 90 days; expired or revoked invitations after 30 days; reports 365 days after they are handled; anti-abuse counters after 2 days.',
        'Providers: Open-Meteo, 90 days for logs; Anthropic, normally 30 days.',
      ],
    },
    {
      id: 'children',
      h: '10. Children',
      p: ['Child profiles are created and managed by a parent within a family; restrictions apply to these profiles. A child should not create an account or use Bilal without a parent’s agreement.'],
    },
    {
      id: 'rights',
      h: '11. Your rights',
      li: [
        'You can ask to access, correct, erase or port your data, object to processing, or withdraw a consent at any time (without affecting past lawfulness).',
        'Erasure: directly in the app (Community › Delete my account). Consents: Settings › Privacy.',
        'For other requests, email mohamadalhabib@live.com (section 1); we reply within 30 days.',
        'You can complain to the Swiss Federal Data Protection and Information Commissioner (FDPIC, www.edoeb.admin.ch) or, in the European Union, to your national supervisory authority.',
      ],
    },
    {
      id: 'security',
      h: '12. Security',
      p: ['Encrypted connections (HTTPS), password-less sign-in, per-user access rules in the database, invitation codes stored hashed, no secret keys in the app. Messages are not yet end-to-end encrypted.'],
    },
    {
      id: 'changes',
      h: '13. Changes',
      p: ['If something important changes (new data flow, new provider), we update this page and ask for your consent again where needed.'],
    },
  ],
  prevails: 'This is a translation; the French version prevails.',
};

const ar: Policy = {
  title: 'سياسة الخصوصية لتطبيق ذكرو',
  updated: 'آخر تحديث: 30 أكتوبر 2026 (الإصدار 1.0.24)',
  lead: 'يعمل ذكرو بدون حساب وبدون إعلانات. بدون حساب، تبقى عدّاداتك وإعداداتك وقراءتك على جهازك. بعض الميزات الاختيارية ترسل بيانات إلى خوادم: نصفها أدناه واحدةً واحدة، ولا تعمل أكثرها حساسيةً إلا بموافقتك الصريحة.',
  sections: [
    {
      id: 'controller',
      h: '1. المسؤول عن المعالجة',
      p: [
        `${CONTROLLER}.`,
        'شركة ذكرو قيد التأسيس؛ وعندما تتولى التطبيق ستُحدَّث هذه السياسة وستُبلَّغ بذلك داخل التطبيق.',
        'للتواصل بشأن أي سؤال أو طلب يتعلق ببياناتك (الاطلاع، التصحيح، الحذف، الاعتراض): بالبريد الإلكتروني على mohamadalhabib@live.com، أو بالبريد على العنوان أعلاه، أو عبر صفحة الدعم https://mohamadalhabib92.github.io/zikru/support/ (لا تنشر هناك بيانات شخصية: سنتواصل معك بشكل خاص).',
      ],
    },
    {
      id: 'local',
      h: '2. ما يبقى على جهازك',
      li: [
        'عدّادات الذكر والوِرد والأهداف وسجل القراءة والمفضلة والحفظ والإعدادات والمكان المختار: تُحفظ على الجهاز فقط (أو في المتصفح للنسخة الويب).',
        'مواقيت الصلاة والقبلة والتقويم الهجري: تُحسَب على الجهاز دون اتصال.',
        'المحادثة مع بلال: تُحفظ على الجهاز (آخر 40 رسالة)، ويمكن مسحها في أي وقت.',
        'الإشعارات: يجدولها هاتفك محليًا؛ لا يستخدم ذكرو أي خادم للإشعارات.',
        'البلوتوث: يتصل ذكرو فقط بالمسبحة أو الخاتم الذي تختاره لقراءة ضغطات العدّاد. ويُحفظ معرّف الجهاز على الهاتف. ولا يُستعمل البلوتوث لتحديد موقعك.',
      ],
    },
    {
      id: 'location',
      h: '3. الموقع والطقس',
      li: [
        'تحديد الموقع اختياري: يمكنك اختيار مدينة بدلًا منه. إن سمحت به، يُقرأ الموقع أثناء استخدام التطبيق فقط، ويُقرَّب (حوالي 100 م) ويُحفظ على الجهاز للمواقيت والقبلة.',
        'الطقس (متوقف حتى تفعّله): يُرسَل موقع مقرَّب إلى عُشر درجة (حوالي 10 كم) إلى Open-Meteo (شركة OpenMeteo GmbH في بورغلن، سويسرا؛ خوادم في أوروبا وأمريكا الشمالية). وحسب Open-Meteo تُحذف سجلاتها التقنية (عنوان IP والإحداثيات) بعد 90 يومًا.',
        'يُحدَّد اسم المدينة على الجهاز؛ ولا يُرسَل أي موقع إلى خدمة لتحويل الإحداثيات إلى عناوين.',
        'لا يُستعمل الموقع أبدًا للإعلانات أو التتبّع، ولا يُربط بحسابك.',
      ],
    },
    {
      id: 'account',
      h: '4. حساب المجتمع (اختياري)',
      p: ['يُستعمل الحساب فقط لميزات العائلة والحلقات وبلال. تنشئه ببريدك الإلكتروني (رمز لمرة واحدة، بدون كلمة مرور) بعد أن تؤشّر على موافقتك.'],
      li: [
        'البيانات: البريد الإلكتروني؛ الاسم الظاهر (افتراضيًا الجزء الذي قبل « @ » من البريد، ويمكن تعديله)؛ معرّف الحساب؛ مؤشر «ملف طفل» يديره الخادم؛ العائلات والحلقات التي أنت عضو فيها والدعوات؛ رسائل التشجيع التي ترسلها؛ جلسات وعدّادات الذكر المشتركة والأهداف المشتركة وأحداث التقويم العائلي وتفضيلات المشاركة.',
        'قد تكشف هذه البيانات ممارستك الدينية، فهي بيانات حساسة (المادة 5 ج من القانون السويسري لحماية البيانات، والمادة 9 من اللائحة الأوروبية). لا نعالجها إلا بموافقتك الصريحة لتشغيل هذه الميزات، ولا يطّلع عليها إلا الأعضاء الذين تنضم إليهم (قواعد وصول على مستوى قاعدة البيانات).',
        'الاستضافة: Supabase (شركة Supabase Inc. في الولايات المتحدة، بصفتها معالجًا من الباطن)، وقاعدة البيانات مستضافة في زيورخ (سويسرا، منطقة eu-central-2). ويُرسَل بريد تسجيل الدخول عبر خدمة المصادقة لدى Supabase.',
        'تُحفظ جلسة تسجيل الدخول على الجهاز حتى لا تحتاج إلى تسجيل الدخول من جديد، وتُمسح عند تسجيل الخروج.',
        'رسائل التشجيع والجلسات: مشفّرة أثناء النقل ولا يطّلع عليها إلا الأعضاء المعنيون، وليست مشفّرة بعدُ تشفيرًا تامًّا بين الطرفين (مخطَّط له). الروابط مرفوضة، ويحجب مرشّح أساسي الشتائم الجسيمة. لا يراسل الطفل افتراضيًا إلا والديه، ويمكن للوالد إيقاف المراسلة كليًا.',
        'الأمان والإشراف: يمكنك الإبلاغ عن محتوى أو شخص وحظر أحد. يرسل البلاغ إلى فريق Zikru نسخة من المحتوى المبلَّغ عنه ومعرّف حسابك والسبب وملاحظتك، ولا يُعلَم الشخص المبلَّغ عنه. وتحدّ عدّادات تقنية من الإساءة (الرسائل والدعوات ومحاولات الرموز). عنوان الإشراف: mohamadalhabib@live.com.',
      ],
    },
    {
      id: 'ai',
      h: '5. بلال، المساعد بالذكاء الاصطناعي (اختياري)',
      li: [
        'قبل أول رسالة يطلب ذكرو موافقتك الصريحة، ويمكنك سحبها من الإعدادات › الخصوصية. بدون موافقة لا يُرسَل شيء، وتأتي خاطرة اليوم من المجموعة المحلية.',
        'ما يُرسَل: رسائلك وآخر 12 رسالة من المحادثة (أو، لخاطرة اليوم، وقت اليوم فقط). تمر عبر وظيفة الخادم لدينا في Supabase (زيورخ) ثم تُنقل إلى مزوّد الذكاء الاصطناعي Anthropic PBC (نموذج Claude) في الولايات المتحدة.',
        'يُستعمل معرّف حسابك فقط لحساب الحصة اليومية (عدّاد واحد لكل يوم) ولا يُنقل إلى Anthropic. ولا يحفظ ذكرو محتوى الرسائل على خوادمه.',
        'حسب Anthropic، يُحذف المحتوى الذي تستقبله واجهتها البرمجية عادةً خلال 30 يومًا (ولمدة أطول فقط عند الإبلاغ عن إساءة أو بموجب التزام قانوني)، ولا يُستعمل لتدريب نماذجها.',
        'إذا غيّرنا مزوّد الذكاء الاصطناعي، ستُحدَّث هذه السياسة وتُطلب موافقتك من جديد.',
        'لا تذكر بيانات صحية أو ما يدلّ على هويتك. بلال ليس عالِمًا ولا طبيبًا.',
      ],
    },
    {
      id: 'content',
      h: '6. المحتوى القرآني والصوت والبحث',
      li: [
        'نص القرآن بالعربية مُدمَج في التطبيق. وبعض الميزات تُنزّل المحتوى عند الطلب: الترجمات والبحث (api.alquran.cloud)، والتفسير (api.quran.com)، والتلاوات الصوتية (everyayah.com وcdn.islamic.network وmp3quran.net).',
        'تستقبل هذه الخوادم، مثل أي موقع ويب، عنوان IP الخاص بك والعنصر المطلوب؛ وفي البحث عبر الإنترنت، نص البحث. ولا يُرسَل إليها أي معرّف حساب.',
        'الموقع الإلكتروني والنسخة الويب (PWA) مستضافان على GitHub Pages (شركة GitHub Inc. في الولايات المتحدة) التي تحتفظ بسجلات تقنية (منها عنوان IP) لأغراض الأمان.',
      ],
    },
    {
      id: 'never',
      h: '7. ما لا نفعله أبدًا',
      li: [
        'لا إعلانات، ولا أدوات تحليل أو تتبّع، ولا تنميط.',
        'لا بيع ولا تأجير ولا تنازل عن بياناتك.',
        'لا مشاركة مع أطراف أخرى غير المزوّدين التقنيين المذكورين هنا، الذين يعملون فقط لتشغيل الخدمة.',
      ],
    },
    {
      id: 'transfers',
      h: '8. النقل إلى الخارج',
      p: [
        'بيانات الحساب مستضافة في سويسرا. وقد تصل إليها شركة Supabase Inc. (الولايات المتحدة) بصفتها معالجًا من الباطن وفق ضماناتها التعاقدية (البنود التعاقدية النموذجية). أما إرسال رسائل بلال إلى الولايات المتحدة فيقوم على موافقتك الصريحة (المادة 17 الفقرة 1 أ من القانون السويسري، والمادة 49 الفقرة 1 أ من اللائحة الأوروبية). ويعالج الطقسَ مزوّدٌ سويسري.',
      ],
    },
    {
      id: 'retention',
      h: '9. مدة الحفظ والحذف',
      li: [
        'البيانات المحلية: حتى تمسحها (الإعدادات › إعادة التعيين) أو تحذف التطبيق.',
        'الحساب: ما دمت تحتفظ به. يمسح خيار «حذف حسابي» (المجتمع) حسابك والبيانات المرتبطة به فورًا، وكذلك العائلات التي أنت وليّها الوحيد. وتُستبدل النسخ الاحتياطية التقنية لدى المستضيف حسب دورتها.',
        'حصة بلال: عدّاد يومي يُحذف مع الحساب.',
        'المجتمعات (حذف تلقائي كل ليلة): رسائل التشجيع بعد 365 يومًا؛ الجلسات المباشرة المنتهية بعد 90 يومًا؛ الدعوات المنتهية أو الملغاة بعد 30 يومًا؛ البلاغات بعد 365 يومًا من معالجتها؛ عدّادات مكافحة الإساءة بعد يومين.',
        'المزوّدون: Open-Meteo، 90 يومًا للسجلات؛ Anthropic، عادةً 30 يومًا.',
      ],
    },
    {
      id: 'children',
      h: '10. الأطفال',
      p: ['يُنشئ أحد الوالدين ملفات الأطفال ويديرها داخل العائلة، وتُطبَّق قيود على هذه الملفات. ولا ينبغي للطفل إنشاء حساب أو استخدام بلال دون موافقة أحد الوالدين.'],
    },
    {
      id: 'rights',
      h: '11. حقوقك',
      li: [
        'يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها أو نقلها، أو الاعتراض على معالجتها، أو سحب أي موافقة في أي وقت (دون أثر على مشروعية ما سبق).',
        'الحذف: مباشرةً في التطبيق (المجتمع › حذف حسابي). الموافقات: الإعدادات › الخصوصية.',
        'للطلبات الأخرى راسلنا على mohamadalhabib@live.com (القسم 1)؛ نجيب خلال 30 يومًا.',
        'يمكنك تقديم شكوى إلى المفوض الفيدرالي السويسري لحماية البيانات والشفافية (www.edoeb.admin.ch)، أو في الاتحاد الأوروبي إلى سلطة الرقابة في بلدك.',
      ],
    },
    {
      id: 'security',
      h: '12. الأمان',
      p: ['اتصالات مشفّرة (HTTPS)، وتسجيل دخول بدون كلمة مرور، وقواعد وصول لكل مستخدم في قاعدة البيانات، ورموز الدعوة محفوظة بصيغة مجزّأة (hash)، ولا مفاتيح سرية داخل التطبيق. الرسائل ليست مشفّرة بعدُ تشفيرًا تامًّا بين الطرفين.'],
    },
    {
      id: 'changes',
      h: '13. التعديلات',
      p: ['عند أي تغيير مهم (تدفق بيانات جديد أو مزوّد جديد) نحدّث هذه الصفحة ونطلب موافقتك من جديد عند الحاجة.'],
    },
  ],
  prevails: 'هذه ترجمة؛ والنسخة الفرنسية هي المرجع.',
};

export const POLICY: Record<PolicyLang, Policy> = { fr, en, ar };
