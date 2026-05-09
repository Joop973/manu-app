import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BookingRow } from '@/components/BookingRow';
import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { isInMonth } from '@/lib/dates';
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
        {tenant.rentCold !== undefined ? (
          <Text style={text.body}>Kaltmiete: {formatEuro(tenant.rentCold)}</Text>
        ) : null}
        {tenant.rentWarm !== undefined ? (
          <Text style={text.body}>Warmmiete: {formatEuro(tenant.rentWarm)}</Text>
        ) : null}
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
            label="📞 Anrufen"
            variant="green"
            onPress={() => Linking.openURL(`tel:${tenant.phone}`)}
            style={{ flex: 1 }}
          />
        ) : null}
        {tenant.email ? (
          <CasinoButton
            label="✉️ E-Mail"
            variant="ghost"
            onPress={() => Linking.openURL(`mailto:${tenant.email}`)}
            style={{ flex: 1 }}
          />
        ) : null}
      </View>

      <Text style={text.sectionTitle}>Letzte Mietzahlungen</Text>
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
});
