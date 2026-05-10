import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { exportCsv, exportPdf } from '@/lib/reports';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-111 Custom Report Generator (PDF + CSV).
 */
export default function ReportsScreen() {
  const bookings = useAppStore((s) => s.bookings);
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;

  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(yearEnd);
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const togglePropertyId = (id: string) => {
    setPropertyIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const wrap = async (fn: () => Promise<string>) => {
    try {
      setBusy(true);
      await fn();
    } catch (e) {
      Alert.alert('Fehler beim Export', String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = () =>
    wrap(() =>
      exportPdf({
        bookings,
        properties,
        categories,
        fromDate,
        toDate,
        propertyIds: propertyIds.length > 0 ? propertyIds : null,
        title: `Bericht ${fromDate} bis ${toDate}`,
      }),
    );

  const handleCsv = () =>
    wrap(() =>
      exportCsv({
        bookings,
        properties,
        categories,
        fromDate,
        toDate,
        propertyIds: propertyIds.length > 0 ? propertyIds : null,
      }),
    );

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Reports</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        PDF + CSV-Export für Steuerberater / Banken (F-111)
      </Text>

      <View style={[styles.card, shadows.card]}>
        <Field label="Von (YYYY-MM-DD)">
          <TextField value={fromDate} onChangeText={setFromDate} />
        </Field>
        <Field label="Bis (YYYY-MM-DD)">
          <TextField value={toDate} onChangeText={setToDate} />
        </Field>

        {properties.length > 0 ? (
          <Field label="Filter — Objekte (leer = alle)">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {properties.map((p) => (
                <GoldChip
                  key={p.id}
                  label={p.name}
                  selected={propertyIds.includes(p.id)}
                  onPress={() => togglePropertyId(p.id)}
                />
              ))}
            </ScrollView>
          </Field>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <CasinoButton label="📄 PDF" variant="gold" onPress={handlePdf} style={{ flex: 1 }} disabled={busy} />
          <CasinoButton label="📊 CSV" variant="ghost" onPress={handleCsv} style={{ flex: 1 }} disabled={busy} />
        </View>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>Schnell-Reports</Text>
        <CasinoButton
          label="Aktueller Monat (PDF)"
          variant="ghost"
          onPress={() => {
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const last = new Date(y, now.getMonth() + 1, 0).getDate();
            wrap(() =>
              exportPdf({
                bookings,
                properties,
                categories,
                fromDate: `${y}-${m}-01`,
                toDate: `${y}-${m}-${String(last).padStart(2, '0')}`,
                propertyIds: null,
                title: `Monat ${m}/${y}`,
              }),
            );
          }}
        />
        <CasinoButton
          label="Letztes Jahr (PDF)"
          variant="ghost"
          onPress={() => {
            const y = now.getFullYear() - 1;
            wrap(() =>
              exportPdf({
                bookings,
                properties,
                categories,
                fromDate: `${y}-01-01`,
                toDate: `${y}-12-31`,
                propertyIds: null,
                title: `Jahr ${y}`,
              }),
            );
          }}
        />
      </View>
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
    gap: spacing.md,
  },
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
});
