import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart, BarPoint } from '@/components/BarChart';
import { CasinoButton } from '@/components/CasinoButton';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { buildForecast, buildYearStats } from '@/lib/forecast';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export default function YearScreen() {
  const bookings = useAppStore((s) => s.bookings);
  const templates = useAppStore((s) => s.templates);
  const categories = useAppStore((s) => s.categories);
  const currentMonth = useAppStore((s) => s.currentMonth);

  const currentYear = Number(currentMonth.slice(0, 4));
  const [year, setYear] = useState(currentYear);

  const stats = buildYearStats(bookings, year);
  const bars: BarPoint[] = stats.months.map((m, i) => ({
    label: MONTH_SHORT[i],
    income: m.income,
    expense: m.expense,
  }));

  const forecast = buildForecast(bookings, templates, currentMonth, 6);

  const maxExpense = Math.max(1, ...stats.topCategories.map((c) => c.sum));

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Jahres-Checkup</Text>

      <View style={styles.yearRow}>
        <CasinoButton label="‹" variant="ghost" onPress={() => setYear((y) => y - 1)} style={{ width: 64 }} />
        <Text style={text.sectionTitle}>{year}</Text>
        <CasinoButton label="›" variant="ghost" onPress={() => setYear((y) => y + 1)} style={{ width: 64 }} />
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>Bilanz {year}</Text>
        <BarChart data={bars} />
      </View>

      <View style={styles.kpis}>
        <View style={[styles.kpi, shadows.card]}>
          <Text style={text.caption}>Einnahmen</Text>
          <Text style={[text.amountMedium, { color: palette.successGreen }]}>{formatEuro(stats.income)}</Text>
        </View>
        <View style={[styles.kpi, shadows.card]}>
          <Text style={text.caption}>Ausgaben</Text>
          <Text style={[text.amountMedium, { color: palette.dangerRed }]}>{formatEuro(stats.expense)}</Text>
        </View>
        <View style={[styles.kpi, shadows.card]}>
          <Text style={text.caption}>Profit</Text>
          <Text
            style={[
              text.amountMedium,
              { color: stats.profit >= 0 ? palette.successGreen : palette.dangerRed },
            ]}
          >
            {formatEuro(stats.profit)}
          </Text>
          <Text style={text.caption}>{(stats.margin * 100).toFixed(0)} % Marge</Text>
        </View>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>Top-Ausgaben-Kategorien</Text>
        {stats.topCategories.length === 0 ? (
          <Text style={text.subhead}>Keine Ausgaben in {year}.</Text>
        ) : (
          stats.topCategories.map((c) => {
            const cat = categories.find((x) => x.id === c.categoryId);
            return (
              <View key={c.categoryId ?? 'none'} style={styles.bar}>
                <View style={styles.barLabelRow}>
                  <Text style={text.body}>
                    {cat ? `${cat.emoji} ${cat.label}` : 'Ohne Kategorie'}
                  </Text>
                  <Text style={text.bodyBold}>{formatEuro(c.sum)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(c.sum / maxExpense) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>📈 Prognose nächste 6 Monate (F-038)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {forecast
              .filter((p) => p.isForecast)
              .map((p) => (
                <View
                  key={p.month}
                  style={[
                    styles.forecastChip,
                    {
                      borderColor: p.balance >= 0 ? palette.successGreen : palette.dangerRed,
                    },
                  ]}
                >
                  <Text style={text.caption}>{p.month.slice(5)}</Text>
                  <Text
                    style={[
                      text.bodyBold,
                      { color: p.balance >= 0 ? palette.successGreen : palette.dangerRed },
                    ]}
                  >
                    {formatEuro(p.balance)}
                  </Text>
                </View>
              ))}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  kpis: { flexDirection: 'row', gap: spacing.sm },
  kpi: {
    flex: 1,
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.md,
    gap: 4,
  },
  bar: { gap: 4 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.royalBlueAccent,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: palette.imperialGold, borderRadius: 5 },
  forecastChip: {
    minWidth: 80,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderRadius: radii.lg,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
});
