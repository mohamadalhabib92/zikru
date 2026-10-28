import { Platform, type ViewStyle } from 'react-native';

/**
 * Système de design Zikru (1.0.19) — un seul thème premium, clair ou sombre.
 *
 * `theme` (anciens écrans) et `brand` (écrans « cartes claires ») sont deux vues des MÊMES
 * jetons : `applyScheme()` les réécrit en place, puis la racine remonte l'arbre (clé = schéma)
 * pour que tous les écrans se redessinent. Toujours lire les valeurs au rendu, jamais les
 * copier dans une constante de module.
 */
export type Scheme = 'light' | 'dark';

const LIGHT = {
  bg: '#F7F4EE',
  surface: '#FFFFFF',
  surfaceAlt: '#F0ECE3',
  text: '#15211C',
  muted: '#5C6A63',
  primary: '#0E6B4F',
  onPrimary: '#FFFFFF',
  accent: '#8F6F1E',
  border: '#E5DFD3',
  danger: '#B42318',
  dangerBg: '#FDECEA',
  success: '#177245',
  successBg: '#E3F3E9',
  warning: '#8A5A00',
  warningBg: '#FBF0D5',
  info: '#1F5FA8',
  infoBg: '#E7EFF9',
};
const DARK: typeof LIGHT = {
  bg: '#0A1210',
  surface: '#121D19',
  surfaceAlt: '#1A2823',
  text: '#ECE7DC',
  muted: '#A0AEA7',
  primary: '#3DBE8B',
  onPrimary: '#03140D',
  accent: '#D9B65C',
  border: '#24352E',
  danger: '#F0806E',
  dangerBg: '#3A1D19',
  success: '#6FD09A',
  successBg: '#15301F',
  warning: '#E8BE62',
  warningBg: '#352A12',
  info: '#8DB9E6',
  infoBg: '#142536',
};

export const theme = {
  ...LIGHT,
  radius: 16,
  displayFont: undefined as string | undefined,
};
export type Theme = typeof theme;

/** Palette de marque : émeraude profonde + or discret (les clés historiques sont conservées). */
const BRAND_LIGHT = {
  // « brown* » = couleur d'en-tête historique → désormais émeraude profonde
  brown: '#0F3D30',
  brownDark: '#0A2B22',
  brownSoft: '#4F7466',
  cream: LIGHT.bg,
  paper: LIGHT.surface,
  ink: LIGHT.text,
  inkMuted: LIGHT.muted,
  line: LIGHT.border,
  gold: '#E3BE5A',
  goldDeep: '#9C7A22',
  goldSoft: '#FBF3DC',
  green: '#0E6B4F',
  greenDeep: '#0A3F30',
  greenSoft: '#2E8466',
  greenTint: '#E6F2EC',
  purple: '#4B3FA8',
  purpleDeep: '#3A2F8C',
  indigo: '#4338CA',
  blue: '#2A6FB8',
  blueSoft: '#EAF2FB',
  teal: '#2F8F76',
  violet: '#7A4FC8',
  rust: '#A3501E',
  wazifa: '#B88A22',
  hailala: '#6B3FB5',
  wirdGreen: '#2F7D4F',
  hero: '#0F3D30',
  heroText: '#FBF7EE',
  heroMuted: '#BFD3C9',
};
const BRAND_DARK: typeof BRAND_LIGHT = {
  ...BRAND_LIGHT,
  brown: '#123A2E',
  brownDark: '#0B241C',
  brownSoft: '#8DB0A2',
  cream: DARK.bg,
  paper: DARK.surface,
  ink: DARK.text,
  inkMuted: DARK.muted,
  line: DARK.border,
  goldDeep: '#D9B65C',
  goldSoft: '#2A2414',
  green: '#23946B',
  greenDeep: '#0F3A2C',
  greenSoft: '#3E9A78',
  greenTint: '#13291F',
  purple: '#4C42A6',
  blue: '#4D8FD6',
  blueSoft: '#13243A',
  teal: '#3FA88B',
  violet: '#9B7BE0',
  rust: '#D07A45',
  wirdGreen: '#3C9A62',
  hero: '#103428',
  heroText: '#F4EFE4',
  heroMuted: '#A9C3B7',
};
export const brand = { ...BRAND_LIGHT };

let current: Scheme = 'light';
export const currentScheme = () => current;
export const isDark = () => current === 'dark';
/** Réécrit les jetons en place (idempotent). */
export function applyScheme(s: Scheme) {
  if (s === current) return;
  current = s;
  Object.assign(theme, s === 'dark' ? DARK : LIGHT);
  Object.assign(brand, s === 'dark' ? BRAND_DARK : BRAND_LIGHT);
}

/** Espacements (grille de 4). */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
/** Rayons. */
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
/** Typographie : police système (SF Pro sur iOS, toutes graisses + Dynamic Type) ; Amiri pour l'arabe. */
export const fonts = {
  arabic: 'Amiri_400Regular',
  arabicBold: 'Amiri_700Bold',
  quran: 'AmiriQuran_400Regular',
} as const;
export const type = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23 },
  caption: { fontSize: 13, lineHeight: 18 },
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.4 },
};
/** Ombres douces (aucune en mode sombre : on s'appuie sur les surfaces). */
export function elevation(level: 0 | 1 | 2 | 3 = 1): ViewStyle {
  if (!level || current === 'dark') return {};
  if (Platform.OS === 'android') return { elevation: level * 2 };
  return { shadowColor: '#1F3A2E', shadowOpacity: 0.05 + 0.025 * level, shadowRadius: 6 + 6 * level, shadowOffset: { width: 0, height: 2 + level * 2 } };
}
/** Couleur + alpha (hex 6 chiffres). */
export const alpha = (hex: string, a: number) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
