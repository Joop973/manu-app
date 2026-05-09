import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { palette, radii, shadows } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  selected?: boolean;
  style?: ViewStyle;
  compact?: boolean;
}

export function GoldChip({ label, onPress, selected, style, compact }: Props) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.compact,
        {
          backgroundColor: selected ? palette.imperialGold : 'rgba(212,175,55,0.12)',
          borderColor: selected ? palette.imperialGoldLight : palette.cardBorder,
          shadowColor: palette.imperialGoldDark,
          transform: pressed ? [{ translateY: 3 }] : [{ translateY: 0 }],
        },
        selected && shadows.goldChip,
        style,
      ]}
    >
      <Text
        style={{
          color: selected ? '#000' : palette.imperialGold,
          fontFamily: 'Lato_700Bold',
          fontSize: compact ? 12 : 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
