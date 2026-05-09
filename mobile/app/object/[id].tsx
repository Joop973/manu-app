import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookingRow } from '@/components/BookingRow';
import { CasinoButton } from '@/components/CasinoButton';
import { ColorPicker } from '@/components/ColorPicker';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { useAppStore, selectPropertyMonthSummary } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function PropertyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const property = useAppStore((s) => s.properties.find((p) => p.id === id));
  const bookings = useAppStore((s) => s.bookings);
  const categories = useAppStore((s) => s.categories);
  const updateProperty = useAppStore((s) => s.updateProperty);
  const removeProperty = useAppStore((s) => s.removeProperty);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(property?.name ?? '');
  const [address, setAddress] = useState(property?.address ?? '');
  const [notes, setNotes] = useState(property?.notes ?? '');
  const [color, setColor] = useState<string>(property?.color ?? '#D4AF37');

  if (!property) {
    return (
      <Screen>
        <EmptyState icon="❓" title="Objekt nicht gefunden" />
      </Screen>
    );
  }

  const propertyBookings = bookings
    .filter((b) => b.propertyId === property.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);

  const summary = selectPropertyMonthSummary(useAppStore.getState(), property.id);

  if (editing) {
    return (
      <Screen>
        <Text style={text.imperialHeadline}>{property.name}</Text>
        <Field label="Name *">
          <TextField value={name} onChangeText={setName} />
        </Field>
        <Field label="Adresse">
          <TextField value={address} onChangeText={setAddress} />
        </Field>
        <Field label="Notizen">
          <TextField multiline value={notes} onChangeText={setNotes} />
        </Field>
        <Field label="Hausfarbe">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <CasinoButton
          label="Speichern"
          onPress={() => {
            updateProperty(property.id, { name: name.trim() || property.name, address, notes, color });
            setEditing(false);
          }}
        />
        <CasinoButton label="Abbrechen" variant="ghost" onPress={() => setEditing(false)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.header, shadows.card, { borderLeftColor: property.color }]}>
        <Text style={text.imperialHeadline}>{property.name}</Text>
        {property.address ? (
          <Text style={[text.subhead, { textAlign: 'center' }]}>{property.address}</Text>
        ) : null}
        <View style={styles.metrics}>
          <View style={{ flex: 1 }}>
            <Text style={text.caption}>Einnahmen</Text>
            <Text style={[text.amountMedium, { color: palette.successGreen }]}>
              {formatEuro(summary.income)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={text.caption}>Ausgaben</Text>
            <Text style={[text.amountMedium, { color: palette.dangerRed }]}>
              {formatEuro(summary.expense)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={text.caption}>Saldo</Text>
            <Text
              style={[
                text.amountMedium,
                { color: summary.balance >= 0 ? palette.successGreen : palette.dangerRed },
              ]}
            >
              {formatEuro(summary.balance)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <CasinoButton
          label="Bearbeiten"
          variant="ghost"
          onPress={() => setEditing(true)}
          style={{ flex: 1 }}
        />
        <Pressable
          onPress={() =>
            Alert.alert(
              'Objekt löschen?',
              `Alle Buchungen für "${property.name}" werden ebenfalls gelöscht.`,
              [
                { text: 'Abbrechen', style: 'cancel' },
                {
                  text: 'Löschen',
                  style: 'destructive',
                  onPress: () => {
                    removeProperty(property.id);
                    router.back();
                  },
                },
              ],
            )
          }
          style={styles.deleteBtn}
        >
          <Text style={{ color: palette.dangerRed, fontFamily: 'Lato_900Black' }}>🗑️</Text>
        </Pressable>
      </View>

      <Text style={[text.sectionTitle, { marginTop: spacing.md }]}>Letzte Buchungen</Text>
      {propertyBookings.length === 0 ? (
        <EmptyState icon="📜" title="Noch keine Buchungen" />
      ) : null}
      {propertyBookings.map((b) => {
        const category = categories.find((c) => c.id === b.categoryId);
        return <BookingRow key={b.id} booking={b} property={property} category={category} />;
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 6,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  deleteBtn: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,48,44,0.08)',
  },
});
