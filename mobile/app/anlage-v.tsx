import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { computeAnlageV, exportAnlageVPdf } from '@/lib/anlageV';
import { formatEuro } from '@/lib/calc';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function AnlageVScreen() {
  const properties = useAppStore((s) => s.properties);
  const bookings = useAppStore((s) => s.bookings);
  const updateProperty = useAppStore((s) => s.updateProperty);

  const currentYear = new Date().getFullYear();
  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [year, setYear] = useState<number>(currentYear - 1);
  const [editingAfa, setEditingAfa] = useState(false);
  const [afaValue, setAfaValue] = useState('');
  const [afaRate, setAfaRate] = useState('');

  const property = properties.find((p) => p.id === propertyId);
  const result = useMemo(() => {
    if (!property) return null;
    return computeAnlageV({ property, bookings, year });
  }, [property, bookings, year]);

  const saveAfa = () => {
    if (!property) return;
    const value = Number(afaValue.replace(',', '.'));
    const rate = Number(afaRate.replace(',', '.'));
    if (!Number.isFinite(value) || !Number.isFinite(rate)) return Alert.alert('Werte ungültig');
    updateProperty(property.id, {
      afa: { ...property.afa, acquisitionValue: value, ratePercent: rate },
    });
    setEditingAfa(false);
  };

  if (properties.length === 0) {
    return <Screen><EmptyState icon="🏛" title="Keine Objekte angelegt" /></Screen>;
  }

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Anlage V</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Vermietungs-Steuerreport pro Objekt + Jahr (F-041)
      </Text>

      <Field label="Objekt">
        <PropertyPicker value={propertyId} properties={properties} onChange={setPropertyId} allowNone={false} />
      </Field>

      <Field label="Steuerjahr">
        <View style={styles.row}>
          {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
            <GoldChip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
          ))}
        </View>
      </Field>

      {property && (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>AfA-Stammdaten</Text>
          {editingAfa ? (
            <>
              <Field label="Anschaffungswert (Gebäude, €)">
                <TextField value={afaValue} onChangeText={setAfaValue} keyboardType="numbers-and-punctuation" />
              </Field>
              <Field label="AfA-Satz (%)">
                <TextField value={afaRate} onChangeText={setAfaRate} keyboardType="numbers-and-punctuation" placeholder="z.B. 2 oder 2.5" />
              </Field>
              <CasinoButton label="Speichern" onPress={saveAfa} />
              <CasinoButton label="Abbrechen" variant="ghost" onPress={() => setEditingAfa(false)} />
            </>
          ) : (
            <>
              <Text style={text.body}>
                {property.afa?.acquisitionValue
                  ? `Anschaffungswert: ${formatEuro(property.afa.acquisitionValue)}`
                  : 'Kein Anschaffungswert hinterlegt'}
                {property.afa?.ratePercent ? ` · AfA-Satz: ${property.afa.ratePercent}%` : ''}
              </Text>
              <CasinoButton
                label="✏ AfA bearbeiten"
                variant="ghost"
                onPress={() => {
                  setAfaValue(property.afa?.acquisitionValue?.toString() ?? '');
                  setAfaRate(property.afa?.ratePercent?.toString() ?? '2');
                  setEditingAfa(true);
                }}
              />
            </>
          )}
        </View>
      )}

      {result && (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Übersicht {year}</Text>
          <Text style={[text.body, { color: palette.successGreen }]}>
            Einnahmen: {formatEuro(result.totalIncome)}
          </Text>
          <Text style={[text.body, { color: palette.dangerRed }]}>
            Werbungskosten: {formatEuro(result.totalExpense)}
          </Text>
          {result.afaAnnual > 0 && (
            <Text style={text.caption}>davon AfA: {formatEuro(result.afaAnnual)}</Text>
          )}
          <Text
            style={[
              text.amountMedium,
              { color: result.vermietungsErgebnis >= 0 ? palette.successGreen : palette.dangerRed, marginTop: 6 },
            ]}
          >
            Vermietungs-Ergebnis: {formatEuro(result.vermietungsErgebnis)}
          </Text>
        </View>
      )}

      {result && (
        <CasinoButton
          label="📄 Anlage V als PDF exportieren"
          onPress={() => exportAnlageVPdf(result).catch((e) => Alert.alert('Export fehlgeschlagen', String(e)))}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
