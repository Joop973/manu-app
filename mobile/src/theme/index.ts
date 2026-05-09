import { ViewStyle } from 'react-native';
import { palette } from './colors';

export * from './colors';
export * from './typography';

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const shadows = {
  goldChip: {
    shadowColor: palette.imperialGoldDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.95,
    shadowRadius: 0,
    elevation: 8,
  } satisfies ViewStyle,
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  } satisfies ViewStyle,
};

export const card = {
  backgroundColor: palette.royalBlue,
  borderRadius: radii.lg,
  borderWidth: 1,
  borderColor: palette.cardBorder,
  padding: spacing.lg,
} satisfies ViewStyle;
