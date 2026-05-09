import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountInput } from '@/components/AmountInput';
import { CasinoButton } from '@/components/CasinoButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Field } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { evaluateExpression, formatEuro } from '@/lib/calc';
import { today } from '@/lib/dates';
import { useAppStore } from '@/store/useAppStore';
import { palette, spacing, text } from '@/theme';
import { BookingType } from '@/types';

/**
 * F-019: Schnellerfassung — Bottom-Sheet artig, 1 Feld, KI-Vorschlag.
 * In <3s erfasst.
 */
export default function QuickEntryScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const bookings = useAppStore((s) => s.bookings);
  const templates = useAppStore((s) => s.templates);
  const addBooking = useAppStore((s) => s.addBooking);
  const bookFromTemplate = useAppStore((s) => s.bookFromTemplate);

  const [amountRaw, setAmountRaw] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [type, setType] = useState<BookingType>('expense');

  const lastBooking = bookings[bookings.length - 1];
  const guessedPropertyId = lastBooking?.propertyId ?? properties[0]?.id ?? null;

  const guessedCategoryId = useMemo(() => {
    if (amount === null) return null;
    const candidates = bookings.filter((b) => Math.abs(b.amount - amount) / Math.max(1, amount) < 0.1);
    if (candidates.length === 0) return null;
    const tally = new Map<string, number>();
    for (const c of candidates) {
      if (!c.categoryId) continue;
      tally.set(c.categoryId, (tally.get(c.categoryId) ?? 0) + 1);
    }
    let best: [string, number] | null = null;
    for (const entry of tally.entries()) if (!best || entry[1] > best[1]) best = entry;
    return best ? best[0] : null;
  }, [amount, bookings]);

  const [propertyId, setPropertyId] = useState<string | null>(guessedPropertyId);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const effectiveCategoryId = categoryId ?? guessedCategoryId;

  const guessedCategory = categories.find((c) => c.id === effectiveCategoryId);

  const submit = () => {
    const evaluated = amount ?? evaluateExpression(amountRaw);
    if (evaluated === null || evaluated <= 0) {
      Alert.alert('Betrag fehlt');
      return;
    }
    addBooking({
      type,
      amount: evaluated,
      date: today(),
      propertyId,
      categoryId: effectiveCategoryId,
      recurrence: 'none',
    });
    router.back();
  };

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Schnellerfassung</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Betrag tippen — KI ergänzt den Rest
      </Text>

      <View style={styles.typeRow}>
        <GoldChip label="− Ausgabe" selected={type === 'expense'} onPress={() => setType('expense')} />
        <GoldChip label="+ Einnahme" selected={type === 'income'} onPress={() => setType('income')} />
      </View>

      <AmountInput
        value={amountRaw}
        type={type}
        autoFocus
        onChange={(raw, evaluated) => {
          setAmountRaw(raw);
          setAmount(evaluated);
        }}
      />

      {amount !== null ? (
        <View style={styles.guessBox}>
          <Text style={[text.caption, { color: palette.imperialGold }]}>VORSCHLAG</Text>
          <Text style={text.body}>
            {type === 'income' ? '+' : '−'} {formatEuro(amount)}
            {properties.find((p) => p.id === propertyId)
              ? ` · ${properties.find((p) => p.id === propertyId)!.name}`
              : ''}
            {guessedCategory ? ` · ${guessedCategory.emoji} ${guessedCategory.label}` : ''}
          </Text>
        </View>
      ) : null}

      {properties.length > 0 ? (
        <Field label="Objekt">
          <View style={styles.typeRow}>
            <GoldChip
              label="Privat"
              selected={propertyId === null}
              onPress={() => setPropertyId(null)}
              compact
            />
            {properties.map((p) => (
              <GoldChip
                key={p.id}
                label={p.name}
                compact
                selected={propertyId === p.id}
                onPress={() => setPropertyId(p.id)}
              />
            ))}
          </View>
        </Field>
      ) : null}

      <Field label="Kategorie">
        <CategoryPicker value={effectiveCategoryId} categories={categories} onChange={setCategoryId} />
      </Field>

      {templates.length > 0 ? (
        <Field label="Vorlagen (1 Tipp = sofort buchen)">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {templates.map((tpl) => (
              <GoldChip
                key={tpl.id}
                label={`${tpl.type === 'income' ? '+' : '−'} ${tpl.label}`}
                onPress={() => {
                  bookFromTemplate(tpl.id);
                  router.back();
                }}
              />
            ))}
          </ScrollView>
        </Field>
      ) : null}

      <View style={{ height: spacing.md }} />
      <CasinoButton
        label="Speichern (✓)"
        variant={type === 'income' ? 'green' : 'red'}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  guessBox: {
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderColor: palette.cardBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: 12,
  },
});
