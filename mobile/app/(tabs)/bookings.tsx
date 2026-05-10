import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookingRow } from '@/components/BookingRow';
import { CasinoButton } from '@/components/CasinoButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { EmptyState } from '@/components/EmptyState';
import { GoldChip } from '@/components/GoldChip';
import { MonthSlider } from '@/components/MonthSlider';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { SwipeRow } from '@/components/SwipeRow';
import { formatEuro } from '@/lib/calc';
import { isInMonth, monthLabel } from '@/lib/dates';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

type Filter = 'all' | 'income' | 'expense';

export default function BookingsScreen() {
  const router = useRouter();
  const t = useT();
  const bookings = useAppStore((s) => s.bookings);
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);
  const trashBooking = useAppStore((s) => s.trashBooking);
  const bulkUpdateBookings = useAppStore((s) => s.bulkUpdateBookings);
  const bulkTrashBookings = useAppStore((s) => s.bulkTrashBookings);

  const [filter, setFilter] = useState<Filter>('all');
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);

  // Bulk-Edit
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<null | 'property' | 'category'>(null);

  const monthBookings = bookings
    .filter((b) => isInMonth(b.date, currentMonth))
    .filter((b) => (filter === 'all' ? true : b.type === filter))
    .filter((b) => (propertyFilter ? b.propertyId === propertyFilter : true))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const total = monthBookings.reduce((s, b) => s + (b.type === 'income' ? b.amount : -b.amount), 0);

  const toggleSelect = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelected([]);
    setBulkAction(null);
  };

  const applyDeleteAll = () => {
    Alert.alert(t('bulk.deleteAll'), t('bulk.selected', { n: selected.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          bulkTrashBookings(selected);
          exitBulkMode();
        },
      },
    ]);
  };

  return (
    <Screen scrollKey="bookings">
      <Text style={text.imperialHeadline}>{t('tab.bookings')}</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>{monthLabel(currentMonth)}</Text>

      <MonthSlider value={currentMonth} onChange={setCurrentMonth} />

      <View style={styles.filterRow}>
        <GoldChip label="Alle" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <GoldChip label="Einnahmen" selected={filter === 'income'} onPress={() => setFilter('income')} />
        <GoldChip label="Ausgaben" selected={filter === 'expense'} onPress={() => setFilter('expense')} />
        <GoldChip
          label={bulkMode ? '✓ Auswahl' : '☐ Auswahl'}
          selected={bulkMode}
          onPress={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
        />
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

      {bulkMode && selected.length > 0 ? (
        <View style={[styles.bulkBar, shadows.card]}>
          <Text style={text.bodyBold}>{t('bulk.selected', { n: selected.length })}</Text>
          {bulkAction === null ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <CasinoButton
                label={t('bulk.assignProperty')}
                variant="ghost"
                onPress={() => setBulkAction('property')}
              />
              <CasinoButton
                label={t('bulk.assignCategory')}
                variant="ghost"
                onPress={() => setBulkAction('category')}
              />
              <CasinoButton label={t('bulk.deleteAll')} variant="red" onPress={applyDeleteAll} />
            </View>
          ) : bulkAction === 'property' ? (
            <PropertyPicker
              value={null}
              properties={properties}
              onChange={(propertyId) => {
                bulkUpdateBookings(selected, { propertyId });
                exitBulkMode();
              }}
            />
          ) : (
            <CategoryPicker
              value={null}
              categories={categories}
              onChange={(categoryId) => {
                bulkUpdateBookings(selected, { categoryId });
                exitBulkMode();
              }}
            />
          )}
        </View>
      ) : null}

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
        const isSelected = selected.includes(b.id);
        if (bulkMode) {
          return (
            <Pressable
              key={b.id}
              onPress={() => toggleSelect(b.id)}
              style={[
                styles.bulkRow,
                isSelected && { borderColor: palette.imperialGold, backgroundColor: 'rgba(212,175,55,0.10)' },
              ]}
            >
              <Text style={{ fontSize: 18, marginRight: 10 }}>{isSelected ? '☑' : '☐'}</Text>
              <View style={{ flex: 1 }}>
                <BookingRow booking={b} property={property} category={category} />
              </View>
            </Pressable>
          );
        }
        return (
          <SwipeRow key={b.id} onDelete={() => trashBooking(b.id)}>
            <BookingRow booking={b} property={property} category={category} />
          </SwipeRow>
        );
      })}

      <CasinoButton label="+ Neue Buchung" onPress={() => router.push('/booking/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  bulkBar: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.imperialGold,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    marginBottom: spacing.sm,
  },
});
