import type { ReaderTheme } from '@/lib/quran-store';
import { brand as b, isDark } from '@/ui/theme';

/** Couleurs du lecteur : « auto » suit le thème de l’app ; clair, sépia et nuit sont propres à la lecture. */
export type Pal = { bg: string; card: string; ink: string; muted: string; line: string; accent: string; gold: string; dark: boolean };
export function readerPalette(t: ReaderTheme): Pal {
  switch (t) {
    case 'light':
      return { bg: '#FAF8F3', card: '#FFFFFF', ink: '#1C1B18', muted: '#6B675E', line: '#E7E1D4', accent: '#0E6B4F', gold: '#9C7A26', dark: false };
    case 'sepia':
      return { bg: '#F3EAD3', card: '#F9F1DC', ink: '#3A2E1C', muted: '#76664A', line: '#E0D0AA', accent: '#2F6B4F', gold: '#94701F', dark: false };
    case 'night':
      return { bg: '#090D0C', card: '#111816', ink: '#E6E1D3', muted: '#98A39D', line: '#22302A', accent: '#3DBE8B', gold: '#D9B65C', dark: true };
    default:
      return { bg: b.cream, card: b.paper, ink: b.ink, muted: b.inkMuted, line: b.line, accent: b.green, gold: b.goldDeep, dark: isDark() };
  }
}
export const THEMES: { id: ReaderTheme; label: string; swatch: string }[] = [
  { id: 'auto', label: 'Auto', swatch: '#8A9A92' },
  { id: 'light', label: 'Clair', swatch: '#FFFFFF' },
  { id: 'sepia', label: 'Sépia', swatch: '#F3EAD3' },
  { id: 'night', label: 'Nuit', swatch: '#111816' },
];
