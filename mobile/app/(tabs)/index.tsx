import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AchievementsCard } from '@/components/AchievementsCard';
import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { HeatmapCalendar } from '@/components/HeatmapCalendar';
import { HelpHint } from '@/components/HelpHint';
import { MonthSlider } from '@/components/MonthSlider';
import { ObjectCard } from '@/components/ObjectCard';
import { OracleCard } from '@/components/OracleCard';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { computeLeftover } from '@/lib/cashflow';
import { isInMonth } from '@/lib/dates';
import { evaluateGoal } from '@/lib/goals';
import { buildMonthHeatmap } from '@/lib/heatmap';
import { generateOracleTips } from '@/lib/oracle';
import { selectPropertyMonthSummary, useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const bookings = useAppStore((s) => s.bookings);
  const templates = useAppStore((s) => s.templates);
  const subscriptions = useAppStore((s) => s.subscriptions);
  const goals = useAppStore((s) => s.goals);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);
  const clipboardHint = useAppStore((s) => s.clipboardHint);
  const setClipboardHint = useAppStore((s) => s.setClipboardHint);

  const monthBookings = bookings.filter((b) => isInMonth(b.date, currentMonth));
  const totalIncome = monthBookings.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0);
  const totalExpense = monthBookings.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
  const balance = totalIncome - totalExpense;

  const oracleTips = generateOracleTips({ bookings, monthIso: currentMonth });
  const heatmap = useMemo(() => buildMonthHeatmap(bookings, currentMonth), [bookings, currentMonth]);

  // F-105 Leftover Daily-Spend
  const leftover = useMemo(
    () =>
      computeLeftover({
        bookings,
        templates,
        subscriptions,
        today: new Date(),
      }),
    [bookings, templates, subscriptions],
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen scrollKey="dashboard">
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

        {/* Bilanz */}
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

        {/* F-105 Leftover */}
        <View style={[styles.leftoverCard, shadows.card]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[text.caption, { color: palette.imperialGold }]}>HEUTE NOCH VERFÜGBAR</Text>
            <HelpHint
              title="Wieviel kann ich heute noch ausgeben?"
              body="Manu rechnet: aktueller Saldo + erwartete Einnahmen − geplante Pflichten, geteilt durch Tage bis Monatsende. Eine Pufferzahl, kein Verbot."
            />
          </View>
          <Text
            style={[
              text.amountLarge,
              { color: leftover.perDay >= 0 ? palette.successGreen : palette.dangerRed },
            ]}
          >
            {formatEuro(Math.max(0, leftover.perDay))}
          </Text>
          <Text style={text.caption}>
            {leftover.daysRemaining} Tg übrig · Pufferbedarf: {formatEuro(leftover.expectedExpenseRemaining)}
          </Text>
        </View>

        <MonthSlider value={currentMonth} onChange={setCurrentMonth} />

        {/* F-104 Heatmap */}
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>📅 Ausgaben-Heatmap</Text>
          <HeatmapCalendar days={heatmap} />
        </View>

        {/* Orakel-Tipps */}
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

        {/* Goals-Vorschau */}
        {goals.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.sectionHead}>
              <Text style={text.sectionTitle}>🎯 Sparziele</Text>
              <Pressable onPress={() => router.push('/goals')}>
                <Text style={{ color: palette.imperialGold, fontFamily: 'Lato_700Bold' }}>Alle ›</Text>
              </Pressable>
            </View>
            {goals.slice(0, 3).map((g) => {
              const status = evaluateGoal(g);
              return (
                <View key={g.id} style={[styles.card, shadows.card]}>
                  <View style={styles.rowSplit}>
                    <Text style={text.bodyBold}>{g.emoji} {g.label}</Text>
                    <Text style={text.bodyBold}>
                      {formatEuro(g.saved)} / {formatEuro(g.target)}
                    </Text>
                  </View>
                  <ProgressBar percent={status.percent} />
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Quick Actions */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActions}>
          <CasinoButton label="📸 Beleg" onPress={() => router.push('/receipt/scan')} style={{ width: 130 }} />
          <CasinoButton label="📑 CSV" variant="ghost" onPress={() => router.push('/csv-import')} style={{ width: 130 }} />
          <CasinoButton label="🪙 Tresore" variant="ghost" onPress={() => router.push('/tresore')} style={{ width: 130 }} />
          <CasinoButton label="🎯 Ziele" variant="ghost" onPress={() => router.push('/goals')} style={{ width: 130 }} />
          <CasinoButton label="📊 Net Worth" variant="ghost" onPress={() => router.push('/networth')} style={{ width: 150 }} />
          <CasinoButton label="📺 Abos" variant="ghost" onPress={() => router.push('/subscriptions')} style={{ width: 130 }} />
          <CasinoButton label="📜 Verträge" variant="ghost" onPress={() => router.push('/contracts')} style={{ width: 140 }} />
          <CasinoButton label="💼 Budgets" variant="ghost" onPress={() => router.push('/budgets')} style={{ width: 140 }} />
          <CasinoButton label="📈 Investments" variant="ghost" onPress={() => router.push('/investments')} style={{ width: 160 }} />
          <CasinoButton label="📄 Reports" variant="ghost" onPress={() => router.push('/reports')} style={{ width: 130 }} />
        </ScrollView>

        {/* F-118 Achievements */}
        <AchievementsCard />

        {/* F-102 Property P&L als Karten */}
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
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  leftoverCard: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.imperialGold,
    alignItems: 'center',
  },
  balanceRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    gap: spacing.sm,
  },
  rowSplit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickActions: { gap: spacing.sm, paddingVertical: spacing.sm },
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
