import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookingRow } from '@/components/BookingRow';
import { CasinoButton } from '@/components/CasinoButton';
import { ColorPicker } from '@/components/ColorPicker';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { buildPropertyPnL, buildMeterTrend } from '@/lib/propertyAnalytics';
import { buildVacancyPeriods, totalVacancy } from '@/lib/vacancy';
import { useAppStore, selectPropertyMonthSummary } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { MeterType } from '@/types';

const METER_LABEL: Record<MeterType, { emoji: string; label: string }> = {
  strom: { emoji: '⚡', label: 'Strom' },
  gas: { emoji: '🔥', label: 'Gas' },
  wasser: { emoji: '💧', label: 'Wasser' },
  heizung: { emoji: '♨️', label: 'Heizung' },
};

export default function PropertyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const property = useAppStore((s) => s.properties.find((p) => p.id === id));
  const bookings = useAppStore((s) => s.bookings);
  const tenants = useAppStore((s) => s.tenants);
  const categories = useAppStore((s) => s.categories);
  const meterReadings = useAppStore((s) => s.meterReadings);
  const maintenanceLogs = useAppStore((s) => s.maintenanceLogs);
  const craftsmen = useAppStore((s) => s.craftsmen);
  const vacancies = useAppStore((s) => s.vacancies);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const updateProperty = useAppStore((s) => s.updateProperty);
  const removeProperty = useAppStore((s) => s.removeProperty);
  const removeMaintenance = useAppStore((s) => s.removeMaintenance);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(property?.name ?? '');
  const [address, setAddress] = useState(property?.address ?? '');
  const [notes, setNotes] = useState(property?.notes ?? '');
  const [color, setColor] = useState<string>(property?.color ?? '#D4AF37');

  const pnl = useMemo(
    () =>
      property
        ? buildPropertyPnL({
            property,
            bookings,
            tenants,
            maintenance: maintenanceLogs,
            monthIso: currentMonth,
          })
        : null,
    [property, bookings, tenants, maintenanceLogs, currentMonth],
  );

  if (!property || !pnl) {
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

  const propertyMaintenance = maintenanceLogs
    .filter((m) => m.propertyId === property.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const vacancyPeriods = useMemo(
    () => (property ? buildVacancyPeriods({ propertyId: property.id, tenants, vacancies }) : []),
    [property, tenants, vacancies],
  );
  const vacancyTotal = totalVacancy(vacancyPeriods);

  const meterTrendByType = (Object.keys(METER_LABEL) as MeterType[]).map((t) => {
    const points = meterReadings
      .filter((r) => r.propertyId === property.id && r.type === t)
      .map((r) => ({ date: r.date, value: r.value }));
    return { type: t, trend: buildMeterTrend(points) };
  });

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
            <Text style={[text.amountMedium, { color: palette.successGreen }]}>{formatEuro(summary.income)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={text.caption}>Ausgaben</Text>
            <Text style={[text.amountMedium, { color: palette.dangerRed }]}>{formatEuro(summary.expense)}</Text>
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

      {/* F-102 Property P&L */}
      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>P&L (1 / 3 / 12 Monate)</Text>
        <View style={styles.pnlGrid}>
          <PnlCol label="1 Mt" income={pnl.income.m1} expense={pnl.expense.m1} net={pnl.net.m1} />
          <PnlCol label="3 Mt" income={pnl.income.m3} expense={pnl.expense.m3} net={pnl.net.m3} />
          <PnlCol label="12 Mt" income={pnl.income.y1} expense={pnl.expense.y1} net={pnl.net.y1} />
        </View>
        <Text style={text.caption}>
          {pnl.tenantCount} Mieter · {pnl.maintenanceCount} Wartung(en)
          {pnl.vacancyMonths !== undefined && pnl.vacancyMonths > 0
            ? ` · ⚠ ${pnl.vacancyMonths} Mt Leerstand`
            : ''}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <CasinoButton label="✏️ Bearbeiten" variant="ghost" onPress={() => setEditing(true)} style={{ flex: 1 }} />
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

      {/* F-045 Leerstand */}
      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>🏚 Leerstand (12 Monate)</Text>
        {vacancyPeriods.length === 0 ? (
          <Text style={text.subhead}>✓ Keine Lücken erkannt</Text>
        ) : (
          <>
            <Text style={text.body}>
              {vacancyTotal.days} Tage {vacancyTotal.loss > 0 ? `· entgangene Miete: ${formatEuro(vacancyTotal.loss)}` : ''}
            </Text>
            {vacancyPeriods.slice(0, 5).map((p) => (
              <Text
                key={p.fromDate + p.toDate}
                style={[
                  text.caption,
                  { color: p.reason === 'planned' ? palette.imperialGold : palette.dangerRed },
                ]}
              >
                {p.reason === 'planned' ? '🛠 geplant' : '⚠'} {p.fromDate} → {p.toDate} ({p.days} Tg)
                {p.estimatedLoss ? ` · ~${formatEuro(p.estimatedLoss)}` : ''}
              </Text>
            ))}
          </>
        )}
      </View>

      {/* F-044 Übergabeprotokoll */}
      <CasinoButton
        label="📋 Übergabeprotokoll erstellen"
        variant="ghost"
        onPress={() => router.push('/handover/new')}
      />

      {/* F-110 Meter Trend */}
      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>📊 Zählerstand-Trend</Text>
        {meterTrendByType.every((m) => m.trend.length === 0) ? (
          <Text style={text.subhead}>Noch keine Zählerstände erfasst</Text>
        ) : (
          meterTrendByType.map(({ type, trend }) => {
            if (trend.length === 0) return null;
            const last = trend[trend.length - 1];
            const prev = trend.length > 1 ? trend[trend.length - 2] : null;
            const meta = METER_LABEL[type];
            return (
              <View key={type} style={styles.meterRow}>
                <Text style={text.body}>
                  {meta.emoji} {meta.label}: {last.value.toFixed(0)} (Stand {last.date})
                </Text>
                {prev ? (
                  <Text
                    style={[
                      text.caption,
                      { color: last.diff > prev.diff * 1.12 ? palette.dangerRed : palette.marbleWhiteMuted },
                    ]}
                  >
                    +{last.diff.toFixed(0)} seit {prev.date}
                    {last.diff > prev.diff * 1.12 ? ' ⚠ +12% Anomalie' : ''}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
        <CasinoButton label="+ Zählerstand erfassen" variant="ghost" onPress={() => router.push('/reading/new')} />
      </View>

      {/* F-120 Maintenance */}
      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>🔧 Wartungs-Historie</Text>
        {propertyMaintenance.length === 0 ? (
          <Text style={text.subhead}>Noch keine Einträge</Text>
        ) : (
          propertyMaintenance.slice(0, 8).map((m) => {
            const cm = craftsmen.find((c) => c.id === m.craftsmanId);
            return (
              <View key={m.id} style={styles.maintenanceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={text.body}>{m.description}</Text>
                  <Text style={text.caption}>
                    {m.date}
                    {cm ? ` · ${cm.name}` : ''}
                    {m.cost ? ` · ${formatEuro(m.cost)}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => removeMaintenance(m.id)}>
                  <Text style={{ color: palette.dangerRed }}>×</Text>
                </Pressable>
              </View>
            );
          })
        )}
        <CasinoButton label="+ Wartung dokumentieren" variant="ghost" onPress={() => router.push('/maintenance/new')} />
      </View>

      <Text style={[text.sectionTitle, { marginTop: spacing.md }]}>Letzte Buchungen</Text>
      {propertyBookings.length === 0 ? <EmptyState icon="📜" title="Noch keine Buchungen" /> : null}
      {propertyBookings.map((b) => {
        const category = categories.find((c) => c.id === b.categoryId);
        return <BookingRow key={b.id} booking={b} property={property} category={category} />;
      })}
    </Screen>
  );
}

function PnlCol({ label, income, expense, net }: { label: string; income: number; expense: number; net: number }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[text.caption, { color: palette.imperialGold }]}>{label}</Text>
      <Text style={[text.caption, { color: palette.successGreen }]}>+{formatEuro(income)}</Text>
      <Text style={[text.caption, { color: palette.dangerRed }]}>−{formatEuro(expense)}</Text>
      <Text style={[text.bodyBold, { color: net >= 0 ? palette.successGreen : palette.dangerRed }]}>
        {formatEuro(net)}
      </Text>
    </View>
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
  metrics: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pnlGrid: { flexDirection: 'row', gap: spacing.md },
  meterRow: { gap: 2 },
  maintenanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
