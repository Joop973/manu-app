import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { computeNkAbrechnung, exportNkPdf } from '@/lib/nkAbrechnung';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function NkAbrechnungScreen() {
  const properties = useAppStore((s) => s.properties);
  const tenants = useAppStore((s) => s.tenants);
  const bookings = useAppStore((s) => s.bookings);
  const updateProperty = useAppStore((s) => s.updateProperty);
  const updateTenant = useAppStore((s) => s.updateTenant);

  const currentYear = new Date().getFullYear();
  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [year, setYear] = useState<number>(currentYear - 1);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const property = properties.find((p) => p.id === propertyId);
  const tenantsForProperty = tenants.filter((t) => t.propertyId === propertyId);
  const tenant = tenants.find((t) => t.id === tenantId) ?? tenantsForProperty[0];

  const result = useMemo(() => {
    if (!property || !tenant) return null;
    return computeNkAbrechnung({
      property,
      tenant,
      bookings,
      year,
      totalLivingAreaFallback: property.totalLivingArea,
    });
  }, [property, tenant, bookings, year]);

  if (properties.length === 0) {
    return <Screen><EmptyState icon="🏛" title="Keine Objekte" /></Screen>;
  }

  return (
    <Screen>
      <Text style={text.imperialHeadline}>NK-Abrechnung</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Nebenkostenabrechnung pro Mieter + Jahr (F-040)
      </Text>

      <Field label="Objekt">
        <PropertyPicker value={propertyId} properties={properties} onChange={setPropertyId} allowNone={false} />
      </Field>

      <Field label="Jahr">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
            <GoldChip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
          ))}
        </ScrollView>
      </Field>

      <Field label="Mieter">
        {tenantsForProperty.length === 0 ? (
          <Text style={text.subhead}>Keine Mieter für dieses Objekt</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {tenantsForProperty.map((t) => (
              <GoldChip key={t.id} label={t.name} selected={tenant?.id === t.id} onPress={() => setTenantId(t.id)} />
            ))}
          </ScrollView>
        )}
      </Field>

      {property && (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Stammdaten Objekt</Text>
          <Field label="Gesamt-Wohnfläche (m²)">
            <TextField
              value={property.totalLivingArea?.toString() ?? ''}
              onChangeText={(v) => {
                const num = Number(v.replace(',', '.'));
                if (Number.isFinite(num)) updateProperty(property.id, { totalLivingArea: num });
              }}
              keyboardType="numbers-and-punctuation"
            />
          </Field>
        </View>
      )}

      {tenant && (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Stammdaten Mieter</Text>
          <Field label="Wohnfläche (m²)">
            <TextField
              value={tenant.livingArea?.toString() ?? ''}
              onChangeText={(v) => {
                const num = Number(v.replace(',', '.'));
                if (Number.isFinite(num)) updateTenant(tenant.id, { livingArea: num });
              }}
              keyboardType="numbers-and-punctuation"
            />
          </Field>
          <Field label="Personen">
            <TextField
              value={tenant.personCount?.toString() ?? ''}
              onChangeText={(v) => {
                const num = Number(v);
                if (Number.isFinite(num)) updateTenant(tenant.id, { personCount: num });
              }}
              keyboardType="number-pad"
            />
          </Field>
        </View>
      )}

      {result && (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Vorschau</Text>
          {result.items.length === 0 ? (
            <Text style={text.subhead}>Keine umlagefähigen Kosten in {year} erfasst.</Text>
          ) : (
            result.items.map((i) => (
              <View key={i.categoryId} style={styles.row}>
                <Text style={text.body}>
                  {i.label} ({i.distribution})
                </Text>
                <Text style={text.bodyBold}>{formatEuro(i.tenantShare)}</Text>
              </View>
            ))
          )}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={text.body}>Anteil gesamt</Text>
            <Text style={text.bodyBold}>{formatEuro(result.totalAttributable)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={text.body}>Vorauszahlungen</Text>
            <Text style={text.bodyBold}>{formatEuro(result.prepaymentSum)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[text.amountMedium, { color: result.difference > 0 ? palette.dangerRed : palette.successGreen }]}>
              {result.difference > 0 ? 'Nachzahlung' : 'Guthaben'}: {formatEuro(Math.abs(result.difference))}
            </Text>
          </View>
        </View>
      )}

      {result && (
        <CasinoButton
          label="📄 Abrechnung als PDF"
          onPress={() => exportNkPdf(result).catch((e) => Alert.alert('Export fehlgeschlagen', String(e)))}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 4, justifyContent: 'space-between', alignItems: 'center' },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  divider: { height: 1, backgroundColor: palette.cardBorder, marginVertical: 4 },
});
