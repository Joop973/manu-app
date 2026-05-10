import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { today } from '@/lib/dates';
import { useAppStore } from '@/store/useAppStore';
import { spacing, text } from '@/theme';

/**
 * F-120 Maintenance-Historie pro Objekt — Eintrag anlegen.
 */
export default function NewMaintenanceScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const craftsmen = useAppStore((s) => s.craftsmen);
  const addMaintenance = useAppStore((s) => s.addMaintenance);
  const addBooking = useAppStore((s) => s.addBooking);

  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [craftsmanId, setCraftsmanId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [createBooking, setCreateBooking] = useState(true);

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Reparatur, Wartung oder Renovierung dokumentieren (F-120)
      </Text>

      {properties.length > 0 ? (
        <Field label="Objekt *">
          <PropertyPicker
            value={propertyId}
            properties={properties}
            onChange={setPropertyId}
            allowNone={false}
          />
        </Field>
      ) : null}

      <Field label="Datum">
        <TextField value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>

      <Field label="Beschreibung *">
        <TextField
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="z.B. Heizung gewartet, Ventil getauscht"
        />
      </Field>

      <Field label="Kosten (€)">
        <TextField value={cost} onChangeText={setCost} keyboardType="numbers-and-punctuation" />
      </Field>

      {craftsmen.length > 0 ? (
        <Field label="Handwerker">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <GoldChip label="—" selected={craftsmanId === null} onPress={() => setCraftsmanId(null)} />
            {craftsmen.map((c) => (
              <GoldChip
                key={c.id}
                label={c.name}
                selected={craftsmanId === c.id}
                onPress={() => setCraftsmanId(c.id)}
              />
            ))}
          </ScrollView>
        </Field>
      ) : null}

      <Field label="Buchung anlegen?">
        <View style={styles.row}>
          <GoldChip label="Ja" selected={createBooking} onPress={() => setCreateBooking(true)} />
          <GoldChip label="Nein" selected={!createBooking} onPress={() => setCreateBooking(false)} />
        </View>
      </Field>

      <View style={{ height: spacing.md }} />
      <CasinoButton
        label="Eintrag speichern"
        onPress={() => {
          if (!propertyId) return Alert.alert('Objekt fehlt');
          if (!description.trim()) return Alert.alert('Beschreibung fehlt');
          const costNum = cost ? Number(cost.replace(',', '.')) : undefined;

          let bookingId: string | undefined;
          if (createBooking && costNum && costNum > 0) {
            const b = addBooking({
              type: 'expense',
              amount: costNum,
              date,
              propertyId,
              categoryId: 'cat-reparatur',
              counterparty: craftsmen.find((c) => c.id === craftsmanId)?.name,
              note: description.trim(),
              recurrence: 'none',
            });
            bookingId = b.id;
          }

          addMaintenance({
            propertyId,
            craftsmanId: craftsmanId ?? undefined,
            date,
            description: description.trim(),
            cost: costNum,
            bookingId,
          });
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
});
