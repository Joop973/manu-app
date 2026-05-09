import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AmountInput } from '@/components/AmountInput';
import { CasinoButton } from '@/components/CasinoButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { TypeToggle } from '@/components/TypeToggle';
import { evaluateExpression } from '@/lib/calc';
import { useAppStore } from '@/store/useAppStore';
import { spacing, text } from '@/theme';
import { BookingType, Recurrence } from '@/types';

const RECURRENCE: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Einmalig' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'yearly', label: 'Jährlich' },
];

export default function NewTemplateScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const addTemplate = useAppStore((s) => s.addTemplate);

  const [label, setLabel] = useState('');
  const [type, setType] = useState<BookingType>('income');
  const [amountRaw, setAmountRaw] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [counterparty, setCounterparty] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Wiederkehrende Buchungen als 1-Klick-Vorlage (F-022)
      </Text>

      <Field label="Bezeichnung *">
        <TextField placeholder="z.B. Miete Müller" value={label} onChangeText={setLabel} />
      </Field>

      <TypeToggle value={type} onChange={setType} />

      <Field label="Betrag *">
        <AmountInput
          value={amountRaw}
          type={type}
          onChange={(raw, evaluated) => {
            setAmountRaw(raw);
            setAmount(evaluated);
          }}
        />
      </Field>

      {properties.length > 0 ? (
        <Field label="Objekt">
          <PropertyPicker value={propertyId} properties={properties} onChange={setPropertyId} />
        </Field>
      ) : null}

      <Field label="Kategorie">
        <CategoryPicker value={categoryId} categories={categories} onChange={setCategoryId} />
      </Field>

      <Field label="Empfänger / Absender">
        <TextField value={counterparty} onChangeText={setCounterparty} />
      </Field>

      <Field label="Wiederkehrung">
        <View style={styles.row}>
          {RECURRENCE.map((r) => (
            <GoldChip
              key={r.value}
              label={r.label}
              selected={recurrence === r.value}
              onPress={() => setRecurrence(r.value)}
            />
          ))}
        </View>
      </Field>

      <View style={{ height: spacing.md }} />
      <CasinoButton
        label="Vorlage anlegen"
        onPress={() => {
          const evaluated = amount ?? evaluateExpression(amountRaw);
          if (!label.trim()) return Alert.alert('Bezeichnung fehlt');
          if (evaluated === null || evaluated <= 0) return Alert.alert('Betrag fehlt');
          addTemplate({
            label: label.trim(),
            type,
            amount: evaluated,
            propertyId,
            categoryId,
            counterparty: counterparty.trim() || undefined,
            recurrence,
          });
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
