import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { OracleCard } from '@/components/OracleCard';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { evaluateBudgets, suggestBudgetAdjustments } from '@/lib/budgets';
import { formatEuro } from '@/lib/calc';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-113 Envelope Budgeting + F-116 Adaptive Budgeting.
 */
export default function BudgetsScreen() {
  const budgets = useAppStore((s) => s.budgets);
  const bookings = useAppStore((s) => s.bookings);
  const categories = useAppStore((s) => s.categories);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setBudget = useAppStore((s) => s.setBudget);
  const removeBudget = useAppStore((s) => s.removeBudget);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [limit, setLimit] = useState('');

  const status = evaluateBudgets({ budgets, bookings, categories, monthIso: currentMonth });
  const suggestions = suggestBudgetAdjustments({ budgets, bookings, categories, monthIso: currentMonth });

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Budgets</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Envelope-Modus: pro Kategorie ein Monatslimit
      </Text>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>+ Budget setzen</Text>
        <Field label="Kategorie">
          <CategoryPicker value={categoryId} categories={categories} onChange={setCategoryId} />
        </Field>
        <Field label="Monatslimit (€)">
          <TextField value={limit} onChangeText={setLimit} keyboardType="numbers-and-punctuation" />
        </Field>
        <CasinoButton
          label="Speichern"
          onPress={() => {
            if (!categoryId) return Alert.alert('Kategorie fehlt');
            const v = Number(limit.replace(',', '.'));
            if (!Number.isFinite(v) || v <= 0) return Alert.alert('Limit ungültig');
            setBudget(categoryId, v);
            setLimit('');
          }}
        />
      </View>

      {suggestions.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <Text style={text.sectionTitle}>🪄 Vorschläge (F-116)</Text>
          {suggestions.slice(0, 5).map((s) => (
            <OracleCard
              key={s.categoryId}
              tip={{
                id: `sug-${s.categoryId}`,
                kind: 'info',
                title: `${s.categoryLabel} — ${formatEuro(s.suggestedLimit)}/Mt vorgeschlagen`,
                body: s.reason,
              }}
            />
          ))}
        </View>
      ) : null}

      <Text style={text.sectionTitle}>Aktuelle Budgets ({status.length})</Text>
      {status.length === 0 ? (
        <EmptyState icon="💼" title="Keine Budgets gesetzt" />
      ) : null}

      {status.map((s) => (
        <View key={s.budget.id} style={[styles.card, shadows.card]}>
          <View style={styles.row}>
            <Text style={text.bodyBold}>
              {s.category?.emoji} {s.category?.label ?? '?'}
            </Text>
            <Text
              style={[
                text.bodyBold,
                {
                  color:
                    s.state === 'over'
                      ? palette.dangerRed
                      : s.state === 'warning'
                        ? palette.imperialGold
                        : palette.successGreen,
                },
              ]}
            >
              {formatEuro(s.spent)} / {formatEuro(s.limit)}
            </Text>
          </View>
          <ProgressBar
            percent={s.percent}
            fillColor={
              s.state === 'over'
                ? palette.dangerRed
                : s.state === 'warning'
                  ? palette.imperialGold
                  : palette.successGreen
            }
          />
          <Text style={text.caption}>
            {s.state === 'over'
              ? `❌ Überzogen um ${formatEuro(-s.remaining)}`
              : `${formatEuro(s.remaining)} Rest verfügbar`}
          </Text>
          <CasinoButton
            label="🗑 Löschen"
            variant="ghost"
            onPress={() => removeBudget(s.budget.id)}
          />
        </View>
      ))}
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
