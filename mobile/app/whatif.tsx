import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryPicker } from '@/components/CategoryPicker';
import { Field } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { computeWhatIf } from '@/lib/whatif';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-119 Was-wäre-wenn-Slider.
 */
export default function WhatIfScreen() {
  const bookings = useAppStore((s) => s.bookings);
  const categories = useAppStore((s) => s.categories);
  const [categoryId, setCategoryId] = useState<string | null>('cat-miete');
  const [reduction, setReduction] = useState(0.1);

  const result = useMemo(() => {
    if (!categoryId) return null;
    return computeWhatIf({ bookings, categoryId, reductionPercent: reduction });
  }, [bookings, categoryId, reduction]);

  const cat = categories.find((c) => c.id === categoryId);

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Was-wäre-wenn</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Wieviel würde ich sparen, wenn ich in einer Kategorie weniger ausgebe? (F-119)
      </Text>

      <Field label="Kategorie">
        <CategoryPicker value={categoryId} categories={categories} onChange={setCategoryId} />
      </Field>

      <Field label={`Reduktion: ${(reduction * 100).toFixed(0)}%`}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5].map((p) => (
            <GoldChip
              key={p}
              label={`-${(p * 100).toFixed(0)}%`}
              selected={Math.abs(reduction - p) < 0.001}
              onPress={() => setReduction(p)}
            />
          ))}
        </ScrollView>
      </Field>

      {result ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>
            {cat ? `${cat.emoji} ${cat.label}` : 'Kategorie'}
          </Text>
          <Text style={text.body}>
            Aktuell: {formatEuro(result.baselineAnnualSpend)} / Jahr
          </Text>
          <Text style={text.body}>
            Mit −{(reduction * 100).toFixed(0)}%: {formatEuro(result.reducedAnnualSpend)} / Jahr
          </Text>
          <Text style={[text.amountMedium, { color: palette.successGreen }]}>
            Ersparnis: {formatEuro(result.yearlySavings)} / Jahr
          </Text>

          <Text style={[text.sectionTitle, { marginTop: spacing.md, fontSize: 14 }]}>
            Kumuliert
          </Text>
          {result.cumulativeSavingsByYear.map((s, i) => (
            <Text key={i} style={text.body}>
              · Nach {i + 1} Jahr{i === 0 ? '' : 'en'}: {formatEuro(s)}
            </Text>
          ))}
        </View>
      ) : null}
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
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
});
