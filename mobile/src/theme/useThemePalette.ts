import { useColorScheme } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { palette as darkPalette } from './colors';

export const lightPalette = {
  royalBlueDeep: '#FBF7EE',
  royalBlue: '#FFFFFF',
  royalBlueAccent: '#EAE2C9',
  imperialGold: '#8A6D1D',
  imperialGoldLight: '#B8902E',
  imperialGoldDark: '#5C4914',
  marbleWhite: '#1A1A1A',
  marbleWhiteMuted: 'rgba(26,26,26,0.65)',
  successGreen: '#0F6E36',
  successGreenSoft: 'rgba(15,110,54,0.15)',
  dangerRed: '#9B1F1B',
  dangerRedSoft: 'rgba(155,31,27,0.15)',
  cardBorder: 'rgba(138,109,29,0.35)',
  overlay: 'rgba(0,0,0,0.4)',
} as const;

export type Palette = typeof darkPalette;

/**
 * Liefert die aktuelle Palette gemäß Settings (dark / light / system).
 */
export function useThemePalette(): Palette {
  const choice = useAppStore((s) => s.settings.colorScheme);
  const system = useColorScheme();
  if (choice === 'dark') return darkPalette;
  if (choice === 'light') return lightPalette as unknown as Palette;
  // system: bei light-System → light, sonst dark
  if (system === 'light') return lightPalette as unknown as Palette;
  return darkPalette;
}
