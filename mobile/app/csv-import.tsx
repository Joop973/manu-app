import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field } from '@/components/Field';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { parseCsv } from '@/lib/csvImport';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { Booking } from '@/types';

/**
 * F-114 CSV-Import — Bank-Export einlesen, Vorschau, dann importieren.
 */
export default function CsvImportScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const addBookingsBulk = useAppStore((s) => s.addBookingsBulk);

  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [preview, setPreview] = useState<{ format: string; rows: Booking[]; errors: string[] } | null>(null);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const a = result.assets[0];
    try {
      const raw = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = parseCsv(raw, propertyId);
      setPreview(parsed);
    } catch (e) {
      Alert.alert('Lesefehler', String(e));
    }
  };

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Banking-Export einlesen (DKB, Sparkasse, ING, N26 …)
      </Text>

      {properties.length > 0 ? (
        <Field label="Standard-Objekt für Import">
          <PropertyPicker value={propertyId} properties={properties} onChange={setPropertyId} />
        </Field>
      ) : null}

      <CasinoButton label="📑 CSV-Datei wählen" onPress={pick} />

      {preview ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Vorschau · Format: {preview.format}</Text>
          <Text style={text.body}>
            {preview.rows.length} Buchung(en) erkannt
            {preview.errors.length > 0 ? ` · ${preview.errors.length} Fehler` : ''}
          </Text>
          {preview.rows.slice(0, 5).map((r) => (
            <Text key={r.id} style={text.caption}>
              {r.date} · {r.type === 'income' ? '+' : '−'} {formatEuro(r.amount)} · {r.counterparty ?? ''}
            </Text>
          ))}
          {preview.rows.length > 5 ? (
            <Text style={text.caption}>… und {preview.rows.length - 5} weitere</Text>
          ) : null}
          <CasinoButton
            label={`Alle ${preview.rows.length} importieren`}
            variant="green"
            onPress={() => {
              addBookingsBulk(preview.rows);
              Alert.alert('Importiert', `${preview.rows.length} Buchungen hinzugefügt.`);
              router.back();
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
