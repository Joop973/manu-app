import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BookingRow } from '@/components/BookingRow';
import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { isInMonth } from '@/lib/dates';
import { buildTenantTimeline } from '@/lib/propertyAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function TenantDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tenant = useAppStore((s) => s.tenants.find((t) => t.id === id));
  const properties = useAppStore((s) => s.properties);
  const bookings = useAppStore((s) => s.bookings);
  const categories = useAppStore((s) => s.categories);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const removeTenant = useAppStore((s) => s.removeTenant);

  if (!tenant) {
    return <Screen><EmptyState icon="❓" title="Mieter nicht gefunden" /></Screen>;
  }

  const property = properties.find((p) => p.id === tenant.propertyId);

  const tenantPayments = bookings
    .filter(
      (b) =>
        b.type === 'income' &&
        b.categoryId === 'cat-miete' &&
        (b.counterparty ?? '').trim().toLowerCase() === tenant.name.trim().toLowerCase(),
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const paidThisMonth = tenantPayments.find((b) => isInMonth(b.date, currentMonth));
  const status = paidThisMonth ? '✓ Bezahlt' : '⚠ Offen';
  const statusColor = paidThisMonth ? palette.successGreen : palette.dangerRed;

  // F-103 Timeline der letzten 12 Monate
  const timeline = buildTenantTimeline({ tenant, bookings, monthIso: currentMonth });
  const overdueMonths = timeline.filter((p) => p.status === 'missing').length;

  // F-124 Mailto-Reminder bei offener Miete
  const sendMailReminder = () => {
    if (!tenant.email) {
      Alert.alert('Keine E-Mail', 'Hinterlege erst eine E-Mail-Adresse beim Mieter.');
      return;
    }
    const expected = tenant.rentCold ?? tenant.rentWarm ?? 0;
    const subject = encodeURIComponent(`Erinnerung: Miete ${currentMonth}`);
    const body = encodeURIComponent(
      `Hallo ${tenant.name},\n\nin meinen Unterlagen ist bisher kein Mietzahlungseingang für ${currentMonth} verbucht.\n` +
        `${expected > 0 ? `Bitte überweise die Miete in Höhe von ${expected.toFixed(2)} €.\n\n` : ''}` +
        `Vielen Dank und freundliche Grüße.`,
    );
    Linking.openURL(`mailto:${tenant.email}?subject=${subject}&body=${body}`);
  };

  return (
    <Screen>
      <View style={[styles.card, shadows.card]}>
        <Text style={text.imperialHeadline}>{tenant.name}</Text>
        {property ? (
          <Text style={[text.subhead, { textAlign: 'center' }]}>
            {property.name}
            {tenant.unit ? ` · ${tenant.unit}` : ''}
          </Text>
        ) : null}
        <Text style={[text.bodyBold, { color: statusColor, textAlign: 'center', marginTop: 8 }]}>
          {status} ({currentMonth})
        </Text>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>Konditionen</Text>
        {tenant.rentCold !== undefined ? <Text style={text.body}>Kaltmiete: {formatEuro(tenant.rentCold)}</Text> : null}
        {tenant.rentWarm !== undefined ? <Text style={text.body}>Warmmiete: {formatEuro(tenant.rentWarm)}</Text> : null}
        {tenant.deposit !== undefined ? (
          <Text style={text.body}>
            Kaution: {formatEuro(tenant.deposit)} ({tenant.depositPaid ? 'bezahlt' : 'offen'})
          </Text>
        ) : null}
        {tenant.contractStart ? <Text style={text.body}>Beginn: {tenant.contractStart}</Text> : null}
        {tenant.contractEnd ? <Text style={text.body}>Ende: {tenant.contractEnd}</Text> : null}
      </View>

      <View style={styles.actions}>
        {tenant.phone ? (
          <CasinoButton
            label="📞"
            variant="green"
            onPress={() => Linking.openURL(`tel:${tenant.phone}`)}
            style={{ flex: 1 }}
          />
        ) : null}
        {tenant.email ? (
          <CasinoButton
            label="✉️ Mail"
            variant="ghost"
            onPress={() => Linking.openURL(`mailto:${tenant.email}`)}
            style={{ flex: 1 }}
          />
        ) : null}
        {!paidThisMonth ? (
          <CasinoButton
            label="🔔 Erinnerung"
            variant="gold"
            onPress={sendMailReminder}
            style={{ flex: 2 }}
          />
        ) : null}
      </View>

      {/* F-103 Tenant Payment Timeline */}
      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>Zahlungs-Timeline (12 Monate)</Text>
        <View style={styles.timelineRow}>
          {timeline.map((p) => (
            <View
              key={p.monthIso}
              style={[
                styles.timelineCell,
                {
                  backgroundColor:
                    p.status === 'paid'
                      ? palette.successGreen
                      : p.status === 'partial'
                        ? palette.imperialGold
                        : palette.dangerRed,
                },
              ]}
            >
              <Text style={styles.timelineLabel}>{p.monthIso.slice(5, 7)}</Text>
            </View>
          ))}
        </View>
        <Text style={text.caption}>
          {overdueMonths > 0
            ? `⚠ ${overdueMonths} Monat(e) ohne Zahlung`
            : '✓ Lückenlose Zahlungshistorie'}
        </Text>
      </View>

      <Text style={[text.sectionTitle, { marginTop: spacing.md }]}>Letzte Mietzahlungen</Text>
      {tenantPayments.length === 0 ? (
        <EmptyState icon="📜" title="Noch keine Zahlungen erfasst" />
      ) : null}
      {tenantPayments.slice(0, 12).map((b) => {
        const cat = categories.find((c) => c.id === b.categoryId);
        return <BookingRow key={b.id} booking={b} property={property} category={cat} />;
      })}

      <CasinoButton
        label="🗑 Mieter löschen"
        variant="red"
        onPress={() =>
          Alert.alert('Mieter löschen?', tenant.name, [
            { text: 'Abbrechen', style: 'cancel' },
            {
              text: 'Löschen',
              style: 'destructive',
              onPress: () => {
                removeTenant(tenant.id);
                router.back();
              },
            },
          ])
        }
      />
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
    gap: 6,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  timelineRow: { flexDirection: 'row', gap: 4 },
  timelineCell: {
    flex: 1,
    aspectRatio: 0.8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLabel: { color: '#000', fontFamily: 'Lato_700Bold', fontSize: 10 },
});
