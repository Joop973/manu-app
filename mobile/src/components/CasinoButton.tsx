import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import { ScaledText } from './ScaledText';
import { palette, radii, shadows, text } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'gold' | 'green' | 'red' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
  icon?: ReactNode;
}

export function CasinoButton({ label, onPress, variant = 'gold', disabled, style, icon }: Props) {
  const palettes = {
    gold: { bg: palette.imperialGold, fg: '#000', shadow: palette.imperialGoldDark },
    green: { bg: palette.successGreen, fg: '#fff', shadow: '#1B5732' },
    red: { bg: palette.dangerRed, fg: '#fff', shadow: '#7A1B19' },
    ghost: { bg: 'transparent', fg: palette.imperialGold, shadow: 'transparent' },
  } as const;
  const p = palettes[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: p.bg,
          borderColor: variant === 'ghost' ? palette.imperialGold : palette.imperialGoldLight,
          shadowColor: p.shadow,
          opacity: disabled ? 0.4 : 1,
          transform: pressed ? [{ translateY: 4 }] : [{ translateY: 0 }],
        },
        variant !== 'ghost' && shadows.goldChip,
        style,
      ]}
    >
      {icon}
      <ScaledText style={[text.buttonLabel, { color: p.fg }]}>{label}</ScaledText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    borderWidth: 2,
  },
});
