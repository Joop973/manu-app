import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { projectPayoff } from '@/lib/debt';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-117 Debt-Payoff-Planner — pro Liability einen Plan setzen.
 */
export default function DebtScreen() {
  const liabilities = useAppStore((s) => s.liabilities);
  const debtPlans = useAppStore((s) => s.debtPlans);
  const addDebtPlan = useAppStore((s) => s.addDebtPlan);
  const removeDebtPlan = useAppStore((s) => s.removeDebtPlan);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [monthlyPayment, setMonthlyPayment] = useState('');

  const submit = () => {
    if (!activeId) return;
    const v = Number(monthlyPayment.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return Alert.alert('Monatsrate ungültig');
    addDebtPlan({
      liabilityId: activeId,
      monthlyPayment: v,
      startDate: new Date().toISOString().slice(0, 10),
    });
    setMonthlyPayment('');
    setActiveId(null);
  };

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Tilgungsplaner</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Pro Hypothek/Darlehen ein Plan: monatliche Rate → Restlaufzeit + Zinslast (F-117)
      </Text>

      {liabilities.length === 0 ? (
        <EmptyState icon="💸" title="Keine Schulden hinterlegt" description="Lege erst eine Verbindlichkeit unter „Net Worth" an." />
      ) : null}

      {liabilities.map((l) => {
        const plan = debtPlans.find((p) => p.liabilityId === l.id);
        const result = plan
          ? projectPayoff({
              balance: l.balance,
              annualRatePercent: l.interestRate ?? 0,
              monthlyPayment: plan.monthlyPayment,
            })
          : null;
        return (
          <View key={l.id} style={[styles.card, shadows.card]}>
            <View style={styles.row}>
              <Text style={text.bodyBold}>{l.label}</Text>
              <Text style={[text.bodyBold, { color: palette.dangerRed }]}>{formatEuro(l.balance)}</Text>
            </View>
            <Text style={text.caption}>
              {l.kind} · {l.interestRate ?? 0}% p.a.
            </Text>

            {result ? (
              <View style={{ gap: 4 }}>
                <Text style={text.body}>
                  Rate: {formatEuro(plan!.monthlyPayment)}/Mt
                </Text>
                <Text style={text.body}>
                  Restlaufzeit: {result.monthsToPayoff} Mt ({result.yearsToPayoff.toFixed(1)} Jahre)
                </Text>
                <Text style={text.body}>
                  Zinslast: {formatEuro(result.totalInterest)} · Gesamt: {formatEuro(result.totalPaid)}
                </Text>
                <CasinoButton
                  label="🗑 Plan zurücksetzen"
                  variant="ghost"
                  onPress={() => removeDebtPlan(plan!.id)}
                />
              </View>
            ) : activeId === l.id ? (
              <View style={{ gap: spacing.sm }}>
                <Field label="Monatliche Rate (€)">
                  <TextField
                    value={monthlyPayment}
                    onChangeText={setMonthlyPayment}
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                  />
                </Field>
                <CasinoButton label="Plan speichern" onPress={submit} />
                <CasinoButton label="Abbrechen" variant="ghost" onPress={() => setActiveId(null)} />
              </View>
            ) : (
              <CasinoButton
                label="+ Plan setzen"
                onPress={() => setActiveId(l.id)}
              />
            )}
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
