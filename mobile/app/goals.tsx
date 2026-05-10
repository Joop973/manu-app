import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { ProgressBar } from '@/components/ProgressBar';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { evaluateGoal } from '@/lib/goals';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

const EMOJIS = ['🎯', '🏖', '🚗', '🏠', '🛠', '👶', '📚', '💍', '🎓', '🌴'];

/**
 * F-109 Savings Goals.
 */
export default function GoalsScreen() {
  const goals = useAppStore((s) => s.goals);
  const properties = useAppStore((s) => s.properties);
  const addGoal = useAppStore((s) => s.addGoal);
  const contributeToGoal = useAppStore((s) => s.contributeToGoal);
  const removeGoal = useAppStore((s) => s.removeGoal);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [emoji, setEmoji] = useState('🎯');

  const submit = () => {
    if (!label.trim()) return Alert.alert('Bezeichnung fehlt');
    const targetNum = Number(target.replace(',', '.'));
    if (!Number.isFinite(targetNum) || targetNum <= 0) return Alert.alert('Zielbetrag ungültig');
    addGoal({
      label: label.trim(),
      target: targetNum,
      deadline: deadline.trim() || undefined,
      propertyId,
      emoji,
    });
    setLabel('');
    setTarget('');
    setDeadline('');
    setShowForm(false);
  };

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Sparziele</Text>

      <CasinoButton
        label={showForm ? 'Abbrechen' : '+ Neues Sparziel'}
        variant={showForm ? 'ghost' : 'gold'}
        onPress={() => setShowForm((s) => !s)}
      />

      {showForm ? (
        <View style={[styles.card, shadows.card]}>
          <Field label="Bezeichnung *">
            <TextField value={label} onChangeText={setLabel} placeholder="z.B. Reserve Heizung" />
          </Field>
          <Field label="Zielbetrag (€) *">
            <TextField value={target} onChangeText={setTarget} keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label="Deadline (YYYY-MM-DD)">
            <TextField value={deadline} onChangeText={setDeadline} placeholder="optional" />
          </Field>
          {properties.length > 0 ? (
            <Field label="Objekt (optional)">
              <PropertyPicker value={propertyId} properties={properties} onChange={setPropertyId} />
            </Field>
          ) : null}
          <Field label="Symbol">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {EMOJIS.map((e) => (
                <GoldChip key={e} label={e} selected={emoji === e} onPress={() => setEmoji(e)} />
              ))}
            </ScrollView>
          </Field>
          <CasinoButton label="Sparziel speichern" onPress={submit} />
        </View>
      ) : null}

      {goals.length === 0 ? (
        <EmptyState icon="🎯" title="Noch keine Sparziele" />
      ) : null}

      {goals.map((g) => {
        const status = evaluateGoal(g);
        const property = properties.find((p) => p.id === g.propertyId);
        return (
          <View key={g.id} style={[styles.card, shadows.card]}>
            <View style={styles.row}>
              <Text style={text.bodyBold}>
                {g.emoji} {g.label}
              </Text>
              <Text style={[text.bodyBold, { color: palette.imperialGold }]}>
                {formatEuro(g.saved)} / {formatEuro(g.target)}
              </Text>
            </View>
            <ProgressBar percent={status.percent} />
            <Text style={text.caption}>
              {status.status === 'achieved'
                ? '✓ Erreicht!'
                : status.status === 'behind'
                  ? '⚠ Unter Plan'
                  : status.status === 'onTrack'
                    ? '✓ Auf Kurs'
                    : 'Kein Deadline'}
              {status.daysLeft !== undefined && status.status !== 'achieved'
                ? ` · ${status.daysLeft} Tg übrig`
                : ''}
              {status.monthlyNeeded
                ? ` · ${formatEuro(status.monthlyNeeded)}/Mt nötig`
                : ''}
              {property ? ` · ${property.name}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <CasinoButton
                label="+ 50 €"
                variant="green"
                style={{ flex: 1 }}
                onPress={() => contributeToGoal(g.id, 50)}
              />
              <CasinoButton
                label="+ 100 €"
                variant="green"
                style={{ flex: 1 }}
                onPress={() => contributeToGoal(g.id, 100)}
              />
              <CasinoButton
                label="🗑"
                variant="ghost"
                style={{ width: 60 }}
                onPress={() =>
                  Alert.alert('Sparziel löschen?', g.label, [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Löschen', style: 'destructive', onPress: () => removeGoal(g.id) },
                  ])
                }
              />
            </View>
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
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
});
