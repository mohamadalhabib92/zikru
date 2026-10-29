/**
 * Messages Bluetooth destinés à l'utilisateur (FR / EN / AR), indépendants du contexte React :
 * les transports et le gestionnaire les produisent ; la langue suit les réglages (setBleLang).
 */
type L = 'fr' | 'en' | 'ar';
let lang: L = 'fr';
export function setBleLang(l: string) {
  lang = l === 'ar' ? 'ar' : l === 'en' ? 'en' : 'fr';
}

const M = {
  expoGo: {
    fr: 'Module Bluetooth absent : Expo Go ne l’inclut pas. Installez un build de développement ou EAS de Zikru.',
    en: 'Bluetooth module missing: Expo Go does not include it. Install a development or EAS build of Zikru.',
    ar: 'وحدة البلوتوث غير موجودة: لا يتضمنها Expo Go. ثبّت نسخة تطوير أو EAS من ذكرُ.',
  },
  deniedAndroid: {
    fr: 'Autorisation Bluetooth refusée. Activez « Appareils à proximité » pour Zikru dans les réglages Android.',
    en: 'Bluetooth permission denied. Enable “Nearby devices” for Zikru in Android settings.',
    ar: 'تم رفض إذن البلوتوث. فعّل «الأجهزة المجاورة» لذكرُ في إعدادات أندرويد.',
  },
  deniedIos: {
    fr: 'Accès Bluetooth refusé : autorisez Zikru dans Réglages > Confidentialité et sécurité > Bluetooth.',
    en: 'Bluetooth access denied: allow Zikru in Settings > Privacy & Security > Bluetooth.',
    ar: 'تم رفض الوصول إلى البلوتوث: اسمح لذكرُ في الإعدادات > الخصوصية والأمن > البلوتوث.',
  },
  unsupported: {
    fr: 'Cet appareil ne prend pas en charge le Bluetooth basse consommation.',
    en: 'This device does not support Bluetooth Low Energy.',
    ar: 'هذا الجهاز لا يدعم البلوتوث منخفض الطاقة.',
  },
  off: {
    fr: 'Bluetooth désactivé : activez-le (Centre de contrôle ou Réglages) puis réessayez.',
    en: 'Bluetooth is off: turn it on (Control Center or Settings) and try again.',
    ar: 'البلوتوث متوقف: شغّله ثم أعد المحاولة.',
  },
  notReady: {
    fr: 'Bluetooth pas encore prêt : répondez à la demande d’autorisation, puis réessayez.',
    en: 'Bluetooth not ready yet: answer the permission prompt, then try again.',
    ar: 'البلوتوث غير جاهز بعد: أجب على طلب الإذن ثم أعد المحاولة.',
  },
  locationOff: {
    fr: 'Android exige la localisation activée pour rechercher des appareils Bluetooth sur cette version.',
    en: 'Android requires Location to be on to scan for Bluetooth devices on this version.',
    ar: 'يتطلب أندرويد تفعيل الموقع للبحث عن أجهزة البلوتوث في هذا الإصدار.',
  },
  timeout: {
    fr: 'L’appareil ne répond pas (délai dépassé). Rapprochez-le, réveillez-le (appui) et réessayez.',
    en: 'The device did not respond (timeout). Bring it closer, wake it (press) and try again.',
    ar: 'الجهاز لا يستجيب (انتهت المهلة). قرّبه ونبّهه بالضغط ثم أعد المحاولة.',
  },
  notFound: {
    fr: 'Appareil introuvable : il est peut-être éteint, hors de portée ou connecté à un autre téléphone.',
    en: 'Device not found: it may be off, out of range or connected to another phone.',
    ar: 'لم يُعثر على الجهاز: قد يكون مطفأً أو بعيدًا أو متصلًا بهاتف آخر.',
  },
  dropped: {
    fr: 'La connexion a été interrompue par l’appareil. Réessayez ; si cela se répète, oubliez-le dans les réglages Bluetooth du téléphone.',
    en: 'The device dropped the connection. Try again; if it repeats, forget it in the phone’s Bluetooth settings.',
    ar: 'قطع الجهاز الاتصال. أعد المحاولة؛ وإن تكرر ذلك فاحذفه من إعدادات البلوتوث في الهاتف.',
  },
  discovery: {
    fr: 'Connexion établie mais lecture des services impossible. Éteignez/rallumez l’appareil puis réessayez.',
    en: 'Connected, but its services could not be read. Power-cycle the device and try again.',
    ar: 'تم الاتصال لكن تعذّرت قراءة الخدمات. أطفئ الجهاز وشغّله ثم أعد المحاولة.',
  },
  cancelled: {
    fr: 'Connexion annulée.',
    en: 'Connection cancelled.',
    ar: 'أُلغي الاتصال.',
  },
  noNotify: {
    fr: 'Aucune caractéristique de notification accessible. Sur le web, ajoutez l’UUID du service ; si c’est un anneau-télécommande, utilisez le mode clavier.',
    en: 'No notifying characteristic available. On the web, add the service UUID; for a remote-style ring, use keyboard mode.',
    ar: 'لا توجد خاصية إشعار متاحة. على الويب أضف معرّف الخدمة؛ وإن كان خاتمًا بنمط جهاز تحكم فاستخدم وضع لوحة المفاتيح.',
  },
  subFailed: {
    fr: 'Abonnement aux notifications refusé par l’appareil ({n}). Les appuis peuvent ne pas être reçus.',
    en: 'The device refused notifications ({n}). Presses may not be received.',
    ar: 'رفض الجهاز الإشعارات ({n}). قد لا تصل الضغطات.',
  },
  connectFailed: {
    fr: 'Connexion impossible : {m}',
    en: 'Could not connect: {m}',
    ar: 'تعذّر الاتصال: {m}',
  },
  scanFailed: {
    fr: 'Recherche Bluetooth impossible : {m}',
    en: 'Bluetooth scan failed: {m}',
    ar: 'تعذّر البحث عبر البلوتوث: {m}',
  },
} as const;
export type BleMsg = keyof typeof M;

export function bleMsg(k: BleMsg, vars: Record<string, string | number> = {}): string {
  let s: string = M[k][lang];
  for (const [a, v] of Object.entries(vars)) s = s.replace(`{${a}}`, String(v));
  return s;
}

/** Traduit une erreur react-native-ble-plx / Web Bluetooth en message clair (le détail technique reste dans le diagnostic). */
export function friendlyBleError(e: unknown): string {
  const code = (e as { errorCode?: number } | null)?.errorCode;
  const raw = e instanceof Error ? e.message : String(e);
  if (code === 3 || /timed? ?out|délai|timeout/i.test(raw)) return bleMsg('timeout');
  if (code === 2 || /cancel/i.test(raw)) return bleMsg('cancelled');
  if (code === 101 || /unauthori[sz]ed|NotAllowedError/i.test(raw)) return bleMsg('deniedIos');
  if (code === 102 || /powered off/i.test(raw)) return bleMsg('off');
  if (code === 103 || code === 104 || /unknown state|resetting/i.test(raw)) return bleMsg('notReady');
  if (code === 204 || /not found/i.test(raw)) return bleMsg('notFound');
  if (code === 201 || /disconnected|GATT Server is disconnected/i.test(raw)) return bleMsg('dropped');
  if (code === 300 || code === 301 || /discover/i.test(raw)) return bleMsg('discovery');
  if (code === 601) return bleMsg('locationOff');
  if (code === 200) return bleMsg('connectFailed', { m: raw });
  return raw;
}
