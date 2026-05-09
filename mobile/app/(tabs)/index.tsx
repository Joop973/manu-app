import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { MonthSlider } from '@/components/MonthSlider';
import { ObjectCard } from '@/components/ObjectCard';
import { OracleCard } from '@/components/OracleCard';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { isInMonth } from '@/lib/dates';
import { generateOracleTips } from '@/lib/oracle';
import { selectPropertyMonthSummary, useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const bookings = useAppStore((s) => s.bookings);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);
  const clipboardHint = useAppStore((s) => s.clipboardHint);
  const setClipboardHint = useAppStore((s) => s.setClipboardHint);

  const monthBookings = bookings.filter((b) => isInMonth(b.date, currentMonth));
  const totalIncome = monthBookings.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0);
  const totalExpense = monthBookings.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
  const balance = totalIncome - totalExpense;

  const oracleTips = generateOracleTips({ bookings, monthIso: currentMonth });

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={styles.headRow}>
          <Pressable onPress={() => router.push('/search')} style={styles.iconBtn}>
            <Text style={{ fontSize: 22, color: palette.imperialGold }}>🔍</Text>
          </Pressable>
          <Text style={text.imperialHeadline}>Marcus Aurelius</Text>
          <Pressable onPress={() => router.push('/year')} style={styles.iconBtn}>
            <Text style={{ fontSize: 22, color: palette.imperialGold }}>📊</Text>
          </Pressable>
        </View>
        <Text style={[text.subhead, { textAlign: 'center' }]}>
          Imperialer Tresor · {properties.length} Objekt{properties.length === 1 ? '' : 'e'}
        </Text>

        {clipboardHint ? (
          <View style={styles.clipboard}>
            <View style={{ flex: 1 }}>
              <Text style={[text.caption, { color: palette.imperialGold }]}>ZWISCHENABLAGE</Text>
              <Text style={text.bodyBold}>
                {clipboardHint.amount !== undefined
                  ? formatEuro(clipboardHint.amount)
                  : clipboardHint.iban}
                {' '}erkannt — Buchung erstellen?
              </Text>
            </View>
            <CasinoButton
              label="Ja"
              variant="gold"
              style={{ height: 40, paddingHorizontal: 14 }}
              onPress={() => {
                router.push({
                  pathname: '/booking/new',
                  params: clipboardHint.amount !== undefined
                    ? { prefillAmount: String(clipboardHint.amount) }
                    : { prefillCounterparty: clipboardHint.iban ?? '' },
                });
                setClipboardHint(null);
              }}
            />
            <Pressable onPress={() => setClipboardHint(null)} hitSlop={8}>
              <Text style={{ color: palette.marbleWhiteMuted, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.balanceCard, shadows.card]}>
          <Text style={[text.caption, { color: palette.imperialGold }]}>GESAMT-BILANZ</Text>
          <Text
            style={[
              text.amountLarge,
              { color: balance >= 0 ? palette.successGreen : palette.dangerRed, marginTop: 4 },
            ]}
          >
            {formatEuro(balance)}
          </Text>
          <View style={styles.balanceRow}>
            <View style={{ flex: 1 }}>
              <Text style={text.caption}>Einnahmen</Text>
              <Text style={[text.amountMedium, { color: palette.successGreen }]}>
                {formatEuro(totalIncome)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={text.caption}>Ausgaben</Text>
              <Text style={[text.amountMedium, { color: palette.dangerRed }]}>
                {formatEuro(totalExpense)}
              </Text>
            </View>
          </View>
        </View>

        <MonthSlider value={currentMonth} onChange={setCurrentMonth} />

        {oracleTips.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.sectionHead}>
              <Text style={text.sectionTitle}>👁 Das Orakel</Text>
              <Pressable onPress={() => router.push('/oracle')}>
                <Text style={{ color: palette.imperialGold, fontFamily: 'Lato_700Bold' }}>
                  Alle ›
                </Text>
              </Pressable>
            </View>
            {oracleTips.map((t) => (
              <OracleCard key={t.id} tip={t} />
            ))}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <CasinoButton
            label="📸 Beleg scannen"
            variant="gold"
            onPress={() => router.push('/receipt/scan')}
            style={{ flex: 1 }}
          />
          <CasinoButton
            label="🪙 Tresore"
            variant="ghost"
            onPress={() => router.push('/tresore')}
            style={{ flex: 1 }}
          />
        </View>

        <View style={styles.sectionHead}>
          <Text style={text.sectionTitle}>Imperien</Text>
          <Pressable onPress={() => router.push('/object/new')}>
            <Text style={{ color: palette.imperialGold, fontFamily: 'Lato_700Bold' }}>+ Neu</Text>
          </Pressable>
        </View>

        {properties.length === 0 ? (
          <EmptyState
            icon="🏛️"
            title="Noch keine Imperien"
            description="Lege dein erstes Objekt an — sei es ein Haus, eine Wohnung oder einfach 'Privat'."
          />
        ) : null}

        {properties.map((p) => {
          const summary = selectPropertyMonthSummary(useAppStore.getState(), p.id);
          return (
            <ObjectCard
              key={p.id}
              property={p}
              income={summary.income}
              expense={summary.expense}
              onPress={() => router.push({ pathname: '/object/[id]', params: { id: p.id } })}
            />
          );
        })}
      </Screen>

      <Pressable
        accessibilityLabel="Schnellerfassung"
        onPress={() => router.push('/booking/quick')}
        style={[styles.fab, shadows.goldChip]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  balanceCard: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  balanceRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  clipboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderColor: palette.cardBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.imperialGold,
    borderWidth: 3,
    borderColor: palette.imperialGoldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: { fontSize: 36, color: '#000', fontFamily: 'Lato_900Black', marginTop: -2 },
});
