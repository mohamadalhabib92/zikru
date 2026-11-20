import { Platform } from 'react-native';

/**
 * Langue d’un texte arabe (Coran, du‘a) pour les lecteurs d’écran : accessibilityLanguage (iOS VoiceOver)
 * et attribut HTML lang="ar" sur le web (react-native-web). À répandre sur <Text {...arLang}>.
 */
export const arLang = (Platform.OS === 'web' ? { lang: 'ar', accessibilityLanguage: 'ar' } : { accessibilityLanguage: 'ar' }) as { accessibilityLanguage: string };
