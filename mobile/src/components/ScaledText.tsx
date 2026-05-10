import { TextProps, Text } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { FontScale } from '@/types';

const SCALE_FACTOR: Record<FontScale, number> = {
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
};

export function useFontScale(): number {
  return SCALE_FACTOR[useAppStore((s) => s.settings.fontScale)];
}

/**
 * F-014 Globale Schriftgröße.
 * Wrapper, der den fontSize-Stil anhand der Settings-Einstellung skaliert.
 */
export function ScaledText({ style, ...rest }: TextProps) {
  const factor = useFontScale();
  // Flache style-Liste sammeln
  const flat = Array.isArray(style) ? style : [style];
  const sizeStyle = flat.reduce<{ fontSize?: number; lineHeight?: number }>((acc, s) => {
    if (!s || typeof s !== 'object') return acc;
    const obj = s as { fontSize?: number; lineHeight?: number };
    if (typeof obj.fontSize === 'number') acc.fontSize = obj.fontSize;
    if (typeof obj.lineHeight === 'number') acc.lineHeight = obj.lineHeight;
    return acc;
  }, {});
  const overrides: { fontSize?: number; lineHeight?: number } = {};
  if (sizeStyle.fontSize) overrides.fontSize = Math.round(sizeStyle.fontSize * factor);
  if (sizeStyle.lineHeight) overrides.lineHeight = Math.round(sizeStyle.lineHeight * factor);
  return <Text {...rest} style={[style, overrides]} />;
}
