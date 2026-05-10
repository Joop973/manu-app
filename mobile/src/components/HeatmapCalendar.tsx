import { StyleSheet, Text, View } from 'react-native';

import { HeatmapDay } from '@/lib/heatmap';
import { palette, radii, spacing, text } from '@/theme';

interface Props {
  days: HeatmapDay[];
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * F-104 Heatmap: 7 Spalten (Wochentage), Zeilen pro Woche.
 * Farbintensität abhängig von der Tagesausgabe.
 */
export function HeatmapCalendar({ days }: Props) {
  if (days.length === 0) return null;
  // Bestimme Wochentag des ersten Tages
  const firstWeekday = (new Date(days[0].date).getDay() + 6) % 7; // Mo=0
  const cells: (HeatmapDay | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (const d of days) cells.push(d);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={[text.caption, styles.weekLabel]}>{w}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((c, idx) => {
          if (!c) return <View key={`e-${idx}`} style={styles.cell} />;
          const intensity = c.intensity;
          const bg = intensity === 0
            ? 'rgba(244,241,234,0.05)'
            : intensity < 0.25
              ? 'rgba(212,175,55,0.25)'
              : intensity < 0.5
                ? 'rgba(212,175,55,0.45)'
                : intensity < 0.75
                  ? 'rgba(212,175,55,0.7)'
                  : palette.imperialGold;
          const day = c.date.slice(8, 10);
          return (
            <View key={c.date} style={[styles.cell, { backgroundColor: bg }]}>
              <Text style={[styles.dayNum, { color: intensity > 0.5 ? '#000' : palette.imperialGold }]}>
                {day}
              </Text>
              {c.total > 0 ? (
                <Text style={[styles.amount, { color: intensity > 0.5 ? '#000' : palette.marbleWhiteMuted }]}>
                  {c.total >= 1000 ? `${Math.round(c.total / 100) / 10}k` : Math.round(c.total)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
  weekLabel: { width: '14%', textAlign: 'center', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  cell: {
    width: '14%',
    aspectRatio: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayNum: { fontFamily: 'Lato_700Bold', fontSize: 11 },
  amount: { fontFamily: 'Lato_400Regular', fontSize: 9 },
});
