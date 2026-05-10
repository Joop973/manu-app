import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BookingRow } from '@/components/BookingRow';
import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { GoldChip } from '@/components/GoldChip';
import { MonthSlider } from '@/components/MonthSlider';
import { Screen } from '@/components/Screen';
import { SwipeRow } from '@/components/SwipeRow';
import { formatEuro } from '@/lib/calc';
import { isInMonth, monthLabel } from '@/lib/dates';
import { useAppStore } from '@/store/useAppStore';
import { palette, spacing, text } from '@/theme';
import { useState } from 'react';

type Filter = 'all' | 'income' | 'expense';

export default function BookingsScreen() {
  const router = useRouter();
  const bookings = useAppStore((s) => s.bookings);
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);
  const removeBooking = useAppStore((s) => s.removeBooking);

  const [filter, setFilter] = useState<Filter>('all');
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);

  const monthBookings = bookings
    .filter((b) => isInMonth(b.date, currentMonth))
    .filter((b) => (filter === 'all' ? true : b.type === filter))
    .filter((b) => (propertyFilter ? b.propertyId === propertyFilter : true))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const total = monthBookings.reduce((s, b) => s + (b.type === 'income' ? b.amount : -b.amount), 0);

  return (
    <Screen scrollKey="bookings">
      <Text style={text.imperialHeadline}>Buchungen</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>{monthLabel(currentMonth)}</Text>

      <MonthSlider value={currentMonth} onChange={setCurrentMonth} />

      <View style={styles.filterRow}>
        <GoldChip label="Alle" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <GoldChip label="Einnahmen" selected={filter === 'income'} onPress={() => setFilter('income')} />
        <GoldChip label="Ausgaben" selected={filter === 'expense'} onPress={() => setFilter('expense')} />
      </View>

      {properties.length > 0 && (
        <View style={styles.filterRow}>
          <GoldChip
            label="Alle Objekte"
            selected={propertyFilter === null}
            onPress={() => setPropertyFilter(null)}
            compact
          />
          {properties.map((p) => (
            <GoldChip
              key={p.id}
              label={p.name}
              compact
              selected={propertyFilter === p.id}
              onPress={() => setPropertyFilter(p.id)}
            />
          ))}
        </View>
      )}

      <View style={styles.summary}>
        <Text style={text.caption}>{monthBookings.length} Buchung(en)</Text>
        <Text style={[text.bodyBold, { color: total >= 0 ? palette.successGreen : palette.dangerRed }]}>
          Saldo: {formatEuro(total)}
        </Text>
      </View>

      {monthBookings.length === 0 ? (
        <EmptyState icon="🎰" title="Keine Buchungen in diesem Monat" />
      ) : null}

      {monthBookings.map((b) => {
        const property = properties.find((p) => p.id === b.propertyId);
        const category = categories.find((c) => c.id === b.categoryId);
        return (
          <SwipeRow
            key={b.id}
            onDelete={() => removeBooking(b.id)}
          >
            <BookingRow booking={b} property={property} category={category} />
          </SwipeRow>
        );
      })}

      <CasinoButton label="+ Neue Buchung" onPress={() => router.push('/booking/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
});
