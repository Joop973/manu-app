import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing } from '@/theme';
import { BookingType } from '@/types';

interface Props {
  value: BookingType;
  onChange: (next: BookingType) => void;
}

export function TypeToggle({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onChange('income')}
        style={[
          styles.side,
          value === 'income' && { backgroundColor: palette.successGreen, borderColor: '#4FAD6E' },
        ]}
      >
        <Text style={[styles.label, value === 'income' && { color: '#fff' }]}>+ Einnahme</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('expense')}
        style={[
          styles.side,
          value === 'expense' && { backgroundColor: palette.dangerRed, borderColor: '#E0584F' },
        ]}
      >
        <Text style={[styles.label, value === 'expense' && { color: '#fff' }]}>− Ausgabe</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  side: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.royalBlue,
    alignItems: 'center',
  },
  label: {
    color: palette.imperialGold,
    fontFamily: 'Lato_900Black',
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
