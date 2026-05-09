import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { spacing, text } from '@/theme';
import { Recurrence, RuleCondition, RuleConditionField } from '@/types';

const FIELD_OPTIONS: { value: RuleConditionField; label: string }[] = [
  { value: 'counterparty', label: 'Empfänger enthält' },
  { value: 'note', label: 'Notiz enthält' },
  { value: 'amountMin', label: 'Betrag ≥' },
  { value: 'amountMax', label: 'Betrag ≤' },
];

export default function NewRuleScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const addRule = useAppStore((s) => s.addRule);

  const [label, setLabel] = useState('');
  const [field, setField] = useState<RuleConditionField>('counterparty');
  const [conditionValue, setConditionValue] = useState('');
  const [setCategoryId, setSetCategoryId] = useState<string | null>(null);
  const [setPropertyId, setSetPropertyId] = useState<string | null>(null);
  const [setRecurrence, setSetRecurrence] = useState<Recurrence>('none');

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        WENN Bedingung erfüllt → DANN Aktion ausführen (F-024)
      </Text>

      <Field label="Bezeichnung *">
        <TextField
          value={label}
          onChangeText={setLabel}
          placeholder="z.B. Strom = Stadtwerke"
        />
      </Field>

      <Field label="WENN — Bedingung">
        <View style={styles.row}>
          {FIELD_OPTIONS.map((opt) => (
            <GoldChip
              key={opt.value}
              label={opt.label}
              compact
              selected={field === opt.value}
              onPress={() => setField(opt.value)}
            />
          ))}
        </View>
        <TextField
          style={{ marginTop: spacing.sm }}
          value={conditionValue}
          onChangeText={setConditionValue}
          placeholder={
            field === 'counterparty'
              ? 'Stadtwerke'
              : field === 'note'
                ? 'Wartung'
                : '500'
          }
          keyboardType={field === 'amountMin' || field === 'amountMax' ? 'numeric' : 'default'}
        />
      </Field>

      <Field label="DANN — Kategorie setzen">
        <CategoryPicker
          value={setCategoryId}
          categories={categories}
          onChange={setSetCategoryId}
        />
      </Field>

      {properties.length > 0 ? (
        <Field label="DANN — Objekt zuordnen">
          <PropertyPicker value={setPropertyId} properties={properties} onChange={setSetPropertyId} />
        </Field>
      ) : null}

      <Field label="DANN — Als wiederkehrend markieren">
        <View style={styles.row}>
          {(['none', 'monthly', 'yearly'] as Recurrence[]).map((r) => (
            <GoldChip
              key={r}
              label={r === 'none' ? 'Nein' : r === 'monthly' ? 'Monatlich' : 'Jährlich'}
              selected={setRecurrence === r}
              onPress={() => setSetRecurrence(r)}
            />
          ))}
        </View>
      </Field>

      <View style={{ height: spacing.md }} />
      <CasinoButton
        label="Regel anlegen"
        onPress={() => {
          if (!label.trim()) return Alert.alert('Bezeichnung fehlt');
          if (!conditionValue.trim()) return Alert.alert('Bedingung fehlt');

          const value: RuleCondition['value'] =
            field === 'amountMin' || field === 'amountMax'
              ? Number(conditionValue.replace(',', '.'))
              : conditionValue.trim();
          if ((field === 'amountMin' || field === 'amountMax') && !Number.isFinite(value as number)) {
            return Alert.alert('Bedingung ungültig');
          }

          addRule({
            label: label.trim(),
            conditions: [{ field, value } as RuleCondition],
            actions: {
              setCategoryId: setCategoryId ?? undefined,
              setPropertyId: setPropertyId ?? undefined,
              setRecurrence: setRecurrence === 'none' ? undefined : setRecurrence,
            },
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
