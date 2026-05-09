import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { addMonths, monthKey, monthLabel } from '@/lib/dates';
import { palette, radii, spacing, text } from '@/theme';

interface Props {
  value: string;
  onChange: (monthIso: string) => void;
}

const RANGE_BACK = 12;
const RANGE_FORWARD = 12;

/**
 * F-006: Monats-Slider — 12 Monate zurück bis 12 Monate voraus.
 */
export function MonthSlider({ value, onChange }: Props) {
  const months = useMemo(() => {
    const current = monthKey(new Date());
    const list: string[] = [];
    for (let i = -RANGE_BACK; i <= RANGE_FORWARD; i += 1) {
      list.push(addMonths(current, i));
    }
    return list;
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => onChange(addMonths(value, -1))} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={[text.sectionTitle, { fontSize: 16 }]}>{monthLabel(value)}</Text>
        <Pressable onPress={() => onChange(addMonths(value, 1))} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
        {months.map((m) => {
          const active = m === value;
          return (
            <Pressable
              key={m}
              onPress={() => onChange(m)}
              style={[styles.dot, active && styles.dotActive]}
            >
              <Text style={[styles.dotText, active && styles.dotTextActive]}>
                {monthLabel(m).split(' ')[0].slice(0, 3)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    paddingVertical: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  arrowText: { color: palette.imperialGold, fontSize: 22, fontFamily: 'Lato_900Black' },
  track: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  dot: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  dotActive: {
    backgroundColor: palette.imperialGold,
    borderColor: palette.imperialGoldLight,
  },
  dotText: {
    color: palette.imperialGold,
    fontFamily: 'Lato_700Bold',
    fontSize: 12,
  },
  dotTextActive: {
    color: '#000',
  },
});
