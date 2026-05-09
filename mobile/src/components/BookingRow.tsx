import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatEuro } from '@/lib/calc';
import { formatDateDe } from '@/lib/dates';
import { palette, radii, spacing, text } from '@/theme';
import { Booking, Category, Property } from '@/types';
import { CategoryDot } from './CategoryPicker';

interface Props {
  booking: Booking;
  property?: Property;
  category?: Category;
  onPress?: () => void;
}

export function BookingRow({ booking, property, category, onPress }: Props) {
  const isIncome = booking.type === 'income';
  const tint = isIncome ? palette.successGreen : palette.dangerRed;
  const tintSoft = isIncome ? palette.successGreenSoft : palette.dangerRedSoft;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? 'rgba(212,175,55,0.08)' : 'transparent' },
      ]}
    >
      <CategoryDot category={category} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[text.bodyBold]} numberOfLines={1}>
            {booking.counterparty || category?.label || 'Buchung'}
          </Text>
          {booking.recurrence !== 'none' && (
            <Text style={styles.recurrence}>{booking.autoBook ? '🔄' : '↻'}</Text>
          )}
        </View>
        <Text style={[text.caption]} numberOfLines={1}>
          {formatDateDe(booking.date)}
          {property ? ` · ${property.name}` : ''}
        </Text>
      </View>
      <View style={[styles.amountChip, { backgroundColor: tintSoft, borderColor: tint }]}>
        <Text style={[text.bodyBold, { color: tint }]}>
          {isIncome ? '+' : '−'} {formatEuro(booking.amount)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recurrence: { fontSize: 12, color: palette.imperialGold },
  amountChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
