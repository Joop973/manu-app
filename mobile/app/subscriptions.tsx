import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { detectSubscriptionCandidates, totalAnnualSubscriptionCost } from '@/lib/subscriptions';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-101 Subscription Detector — listet bestehende und vorgeschlagene Abos.
 */
export default function SubscriptionsScreen() {
  const router = useRouter();
  const subscriptions = useAppStore((s) => s.subscriptions);
  const bookings = useAppStore((s) => s.bookings);
  const categories = useAppStore((s) => s.categories);
  const addSubscription = useAppStore((s) => s.addSubscription);
  const updateSubscription = useAppStore((s) => s.updateSubscription);
  const removeSubscription = useAppStore((s) => s.removeSubscription);

  const candidates = detectSubscriptionCandidates(bookings).filter(
    (c) => !subscriptions.some((s) => s.name.trim().toLowerCase() === c.counterparty.trim().toLowerCase()),
  );

  const annual = totalAnnualSubscriptionCost(subscriptions);

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Abos & Subscriptions</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Lokal aus Buchungshistorie erkannt (F-101)
      </Text>

      {subscriptions.length > 0 ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Aktive Abos</Text>
          <Text style={[text.amountMedium, { color: palette.dangerRed }]}>
            {formatEuro(annual)} / Jahr
          </Text>
          <Text style={text.subhead}>{subscriptions.filter((s) => s.active).length} aktiv</Text>
        </View>
      ) : null}

      {candidates.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <Text style={text.sectionTitle}>🔍 Vorschläge ({candidates.length})</Text>
          {candidates.slice(0, 10).map((c) => (
            <View key={c.counterparty} style={[styles.card, shadows.card]}>
              <View style={styles.row}>
                <Text style={text.bodyBold}>{c.counterparty}</Text>
                <Text style={[text.bodyBold, { color: palette.imperialGold }]}>
                  {formatEuro(c.averageAmount)} / {c.cadence === 'yearly' ? 'Jahr' : 'Monat'}
                </Text>
              </View>
              <Text style={text.caption}>
                {c.occurrences}× erkannt · letzter Eintrag {c.lastDate}
              </Text>
              <CasinoButton
                label="Als Abo aufnehmen"
                onPress={() => {
                  addSubscription({
                    name: c.counterparty,
                    amount: c.averageAmount,
                    cadence: c.cadence === 'yearly' ? 'yearly' : 'monthly',
                    categoryId: c.categoryId ?? null,
                    propertyId: null,
                    active: true,
                    detectedAutomatically: true,
                  });
                }}
              />
            </View>
          ))}
        </View>
      ) : null}

      <Text style={text.sectionTitle}>Verwaltete Abos</Text>
      {subscriptions.length === 0 ? (
        <EmptyState icon="📺" title="Noch keine Abos verwaltet" />
      ) : null}
      {subscriptions.map((s) => {
        const cat = categories.find((c) => c.id === s.categoryId);
        return (
          <View key={s.id} style={[styles.card, shadows.card]}>
            <View style={styles.row}>
              <Text style={text.bodyBold}>{s.name}</Text>
              <Text style={[text.bodyBold, { color: s.active ? palette.imperialGold : palette.marbleWhiteMuted }]}>
                {formatEuro(s.amount)} / {s.cadence === 'yearly' ? 'Jahr' : 'Mt'}
              </Text>
            </View>
            <Text style={text.caption}>
              {cat ? `${cat.emoji} ${cat.label}` : '—'} · {s.active ? 'aktiv' : 'gekündigt'}
              {s.detectedAutomatically ? ' · 🔍 erkannt' : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <CasinoButton
                label={s.active ? '🚫 Kündigen' : '↩ Reaktivieren'}
                variant={s.active ? 'red' : 'green'}
                style={{ flex: 1 }}
                onPress={() => {
                  updateSubscription(s.id, {
                    active: !s.active,
                    cancelledAt: !s.active ? undefined : new Date().toISOString(),
                  });
                }}
              />
              <CasinoButton
                label="🗑"
                variant="ghost"
                style={{ width: 60 }}
                onPress={() =>
                  Alert.alert('Abo löschen?', s.name, [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Löschen', style: 'destructive', onPress: () => removeSubscription(s.id) },
                  ])
                }
              />
            </View>
          </View>
        );
      })}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
