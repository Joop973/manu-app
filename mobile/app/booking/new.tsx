import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AmountInput } from '@/components/AmountInput';
import { CasinoButton } from '@/components/CasinoButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { Suggestions } from '@/components/Suggestions';
import { TypeToggle } from '@/components/TypeToggle';
import { evaluateExpression, formatEuro } from '@/lib/calc';
import { today } from '@/lib/dates';
import { findPossibleDuplicate } from '@/lib/duplicates';
import { applyRules } from '@/lib/rules';
import { suggestsRecurrence } from '@/lib/recurring';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, spacing, text } from '@/theme';
import { BookingType, Recurrence } from '@/types';

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Einmalig' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'yearly', label: 'Jährlich' },
];

export default function NewBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillAmount?: string;
    prefillCounterparty?: string;
    type?: BookingType;
  }>();

  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const bookings = useAppStore((s) => s.bookings);
  const rules = useAppStore((s) => s.rules);
  const addBooking = useAppStore((s) => s.addBooking);
  const addTemplate = useAppStore((s) => s.addTemplate);

  const [type, setType] = useState<BookingType>(params.type ?? 'expense');
  const [amountRaw, setAmountRaw] = useState<string>(params.prefillAmount ?? '');
  const [amount, setAmount] = useState<number | null>(
    params.prefillAmount ? Number(params.prefillAmount) : null,
  );
  const [date, setDate] = useState<string>(today());
  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [counterparty, setCounterparty] = useState<string>(params.prefillCounterparty ?? '');
  const [note, setNote] = useState<string>('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');

  // F-021: Smarte Autovervollständigung — bisherige Empfänger
  const counterpartySuggestions = useMemo(() => {
    if (counterparty.length < 2) return [];
    const lower = counterparty.toLowerCase();
    const seen = new Map<string, number>();
    for (const b of bookings) {
      if (!b.counterparty) continue;
      if (!b.counterparty.toLowerCase().includes(lower)) continue;
      seen.set(b.counterparty, (seen.get(b.counterparty) ?? 0) + 1);
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [counterparty, bookings]);

  // F-018: Pattern Recognition für Wiederkehrend-Vorschlag
  const recurrenceHint = useMemo(() => {
    if (recurrence !== 'none') return false;
    if (amount === null) return false;
    return suggestsRecurrence({ amount, counterparty }, bookings);
  }, [amount, counterparty, recurrence, bookings]);

  const draft = {
    type,
    amount: amount ?? 0,
    date,
    propertyId,
    categoryId,
    counterparty,
    note,
    recurrence,
  };
  const withRules = applyRules(draft, rules);
  const ruleApplied = withRules.ruleId !== undefined;
  const effectiveCategoryId = categoryId ?? withRules.categoryId ?? null;
  const effectivePropertyId = propertyId ?? withRules.propertyId ?? null;

  const submit = () => {
    const evaluated = amount ?? evaluateExpression(amountRaw);
    if (evaluated === null || evaluated <= 0) {
      Alert.alert('Betrag fehlt', 'Bitte einen gültigen Betrag eingeben.');
      return;
    }

    // F-026: Duplikat-Warnung
    const duplicate = findPossibleDuplicate(
      { amount: evaluated, date, propertyId: effectivePropertyId },
      bookings,
    );
    if (duplicate) {
      Alert.alert(
        'Mögliches Duplikat',
        `Eine Buchung mit ${formatEuro(evaluated)} am gleichen Tag existiert bereits. Trotzdem speichern?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Trotzdem speichern',
            onPress: () => {
              addBooking({
                type,
                amount: evaluated,
                date,
                propertyId: effectivePropertyId,
                categoryId: effectiveCategoryId,
                counterparty: counterparty.trim() || undefined,
                note: note.trim() || undefined,
                recurrence,
              });
              router.back();
            },
          },
        ],
      );
      return;
    }

    addBooking({
      type,
      amount: evaluated,
      date,
      propertyId: effectivePropertyId,
      categoryId: effectiveCategoryId,
      counterparty: counterparty.trim() || undefined,
      note: note.trim() || undefined,
      recurrence,
    });
    router.back();
  };

  const saveAsTemplate = () => {
    const evaluated = amount ?? evaluateExpression(amountRaw);
    if (evaluated === null || evaluated <= 0) {
      Alert.alert('Betrag fehlt');
      return;
    }
    addTemplate({
      label: counterparty.trim() || `${formatEuro(evaluated)}`,
      type,
      amount: evaluated,
      propertyId: effectivePropertyId,
      categoryId: effectiveCategoryId,
      counterparty: counterparty.trim() || undefined,
      note: note.trim() || undefined,
      recurrence,
    });
    Alert.alert('Vorlage gesichert', 'Findest du im Tab „Vorlagen".');
  };

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Tippe einen Ausdruck wie 1200-85,50 — die App rechnet (F-020)
      </Text>

      <TypeToggle value={type} onChange={setType} />

      <Field label="Betrag *">
        <AmountInput
          value={amountRaw}
          type={type}
          autoFocus
          onChange={(raw, evaluated) => {
            setAmountRaw(raw);
            setAmount(evaluated);
          }}
        />
      </Field>

      <Field label="Datum">
        <TextField
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
      </Field>

      {properties.length > 0 && (
        <Field label="Objekt">
          <PropertyPicker
            value={propertyId}
            properties={properties}
            onChange={setPropertyId}
          />
        </Field>
      )}

      <Field label="Kategorie (F-017)">
        <CategoryPicker
          value={effectiveCategoryId}
          categories={categories}
          onChange={setCategoryId}
        />
      </Field>

      <Field label="Empfänger / Absender">
        <TextField
          value={counterparty}
          onChangeText={setCounterparty}
          placeholder="z.B. Stadtwerke, Müller, Amazon"
        />
        <Suggestions items={counterpartySuggestions} onPick={setCounterparty} />
      </Field>

      <Field label="Notiz">
        <TextField value={note} onChangeText={setNote} placeholder="frei…" />
      </Field>

      <Field label="Wiederkehrend">
        <View style={styles.row}>
          {RECURRENCE_OPTIONS.map((opt) => (
            <GoldChip
              key={opt.value}
              label={opt.label}
              selected={recurrence === opt.value}
              onPress={() => setRecurrence(opt.value)}
            />
          ))}
        </View>
        {recurrenceHint ? (
          <Text style={[text.caption, { color: palette.imperialGold, marginTop: 6 }]}>
            💡 Wiederkehrendes Muster erkannt — als monatlich markieren?
          </Text>
        ) : null}
      </Field>

      {ruleApplied ? (
        <Text style={[text.caption, { color: palette.imperialGold }]}>
          ✨ Regel angewendet (F-024)
        </Text>
      ) : null}

      <View style={{ height: spacing.md }} />

      <CasinoButton
        label={type === 'income' ? 'Einnahme buchen' : 'Ausgabe buchen'}
        variant={type === 'income' ? 'green' : 'red'}
        onPress={submit}
      />
      <CasinoButton label="Als Vorlage speichern" variant="ghost" onPress={saveAsTemplate} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
