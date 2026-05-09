import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { palette, radii, spacing } from '@/theme';

interface Props {
  items: string[];
  onPick: (value: string) => void;
}

/**
 * F-021: Smarte Autovervollständigung — schlägt bisherige Empfänger vor.
 */
export function Suggestions({ items, onPick }: Props) {
  if (items.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((s) => (
        <Pressable key={s} style={styles.chip} onPress={() => onPick(s)}>
          <Text style={styles.label}>{s}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  label: { color: palette.imperialGold, fontFamily: 'Lato_700Bold', fontSize: 13 },
});
