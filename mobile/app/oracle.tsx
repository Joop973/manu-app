import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { MonthSlider } from '@/components/MonthSlider';
import { OracleCard } from '@/components/OracleCard';
import { Screen } from '@/components/Screen';
import { analyzeMonthDelta, answerQuestion } from '@/lib/analyst';
import { generateOracleTips } from '@/lib/oracle';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function OracleScreen() {
  const bookings = useAppStore((s) => s.bookings);
  const categories = useAppStore((s) => s.categories);
  const properties = useAppStore((s) => s.properties);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);

  const tips = generateOracleTips({ bookings, monthIso: currentMonth });
  const insights = useMemo(
    () => analyzeMonthDelta({ bookings, categories, properties, monthIso: currentMonth }),
    [bookings, categories, properties, currentMonth],
  );

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Das Orakel</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Spartipps + AI-Analyst (regelbasiert) — F-034 / F-123
      </Text>

      <MonthSlider value={currentMonth} onChange={setCurrentMonth} />

      <Text style={text.sectionTitle}>👁 Beobachtungen</Text>
      {tips.length === 0 ? (
        <EmptyState icon="👁" title="Keine Auffälligkeiten" />
      ) : (
        <View style={{ gap: spacing.md }}>
          {tips.map((t) => (
            <OracleCard key={t.id} tip={t} />
          ))}
        </View>
      )}

      <Text style={text.sectionTitle}>🔮 Frag das Orakel</Text>
      <View style={[styles.card, shadows.card]}>
        <Field label="Deine Frage">
          <TextField
            value={question}
            onChangeText={setQuestion}
            placeholder='z.B. "Warum sind die Nebenkosten höher?"'
            multiline
          />
        </Field>
        <CasinoButton
          label="Antworten"
          onPress={() => setAnswer(answerQuestion(question, insights))}
        />
        {answer ? (
          <View style={[styles.answer]}>
            <Text style={[text.body]}>{answer}</Text>
          </View>
        ) : null}
      </View>

      <Text style={text.sectionTitle}>📊 Top-Bewegungen vs. Vormonat</Text>
      {insights.length === 0 ? (
        <EmptyState icon="📊" title="Keine signifikanten Veränderungen" />
      ) : (
        insights.map((i) => (
          <View key={i.id} style={[styles.card, shadows.card]}>
            <Text style={text.bodyBold}>
              {i.trend === 'up' ? '⬆' : i.trend === 'down' ? '⬇' : '→'} {i.headline}
            </Text>
            <Text style={text.subhead}>{i.detail}</Text>
          </View>
        ))
      )}
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
  answer: {
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderColor: palette.imperialGold,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
});
