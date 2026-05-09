import { StyleSheet, Text, View } from 'react-native';

import { palette, spacing, text } from '@/theme';

export interface BarPoint {
  label: string;
  income: number;
  expense: number;
}

interface Props {
  data: BarPoint[];
  height?: number;
}

/**
 * F-037: einfache 12-Monats-Balkenanzeige ohne externe Chart-Lib.
 * Pro Monat zwei dünne Balken (grün=Einnahmen, rot=Ausgaben).
 */
export function BarChart({ data, height = 160 }: Props) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  return (
    <View style={[styles.wrap, { height: height + 36 }]}>
      <View style={[styles.row, { height }]}>
        {data.map((p) => {
          const ih = (p.income / max) * height;
          const eh = (p.expense / max) * height;
          return (
            <View key={p.label} style={styles.month}>
              <View style={styles.bars}>
                <View style={[styles.bar, { height: ih, backgroundColor: palette.successGreen }]} />
                <View style={[styles.bar, { height: eh, backgroundColor: palette.dangerRed }]} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {data.map((p) => (
          <View key={`l-${p.label}`} style={styles.month}>
            <Text style={[text.caption, { textAlign: 'center', fontSize: 10 }]} numberOfLines={1}>
              {p.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  month: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: '100%' },
  bar: { width: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
