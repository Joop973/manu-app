import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { Rule, RuleCondition } from '@/types';

function describeCondition(c: RuleCondition): string {
  switch (c.field) {
    case 'counterparty':
      return `Empfänger enthält "${c.value}"`;
    case 'note':
      return `Notiz enthält "${c.value}"`;
    case 'amountMin':
      return `Betrag ≥ ${c.value}€`;
    case 'amountMax':
      return `Betrag ≤ ${c.value}€`;
  }
}

function describeActions(rule: Rule, propertyLookup: Map<string, string>, categoryLookup: Map<string, string>): string {
  const parts: string[] = [];
  if (rule.actions.setCategoryId) {
    parts.push(`Kategorie: ${categoryLookup.get(rule.actions.setCategoryId) ?? '?'}`);
  }
  if (rule.actions.setPropertyId) {
    parts.push(`Objekt: ${propertyLookup.get(rule.actions.setPropertyId) ?? '?'}`);
  }
  if (rule.actions.setRecurrence && rule.actions.setRecurrence !== 'none') {
    parts.push(`Als ${rule.actions.setRecurrence === 'monthly' ? 'monatlich' : 'jährlich'}`);
  }
  return parts.join(' · ') || 'Keine Aktion';
}

export default function RulesScreen() {
  const router = useRouter();
  const rules = useAppStore((s) => s.rules);
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const removeRule = useAppStore((s) => s.removeRule);

  const propertyLookup = new Map(properties.map((p) => [p.id, p.name]));
  const categoryLookup = new Map(categories.map((c) => [c.id, `${c.emoji} ${c.label}`]));

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Regeln</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        WENN-DANN-Logik (F-024)
      </Text>

      {rules.length === 0 ? (
        <EmptyState
          icon="⚙️"
          title="Noch keine Regeln"
          description='Beispiel: WENN Empfänger "Stadtwerke" → DANN Kategorie ⚡ Strom.'
        />
      ) : null}

      {rules.map((rule) => (
        <View key={rule.id} style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle} numberOfLines={1}>{rule.label}</Text>
          <View style={{ marginTop: 8 }}>
            <Text style={text.caption}>WENN</Text>
            {rule.conditions.map((c, i) => (
              <Text key={i} style={text.body}>· {describeCondition(c)}</Text>
            ))}
            <Text style={[text.caption, { marginTop: 4 }]}>DANN</Text>
            <Text style={text.body}>· {describeActions(rule, propertyLookup, categoryLookup)}</Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert('Regel löschen?', rule.label, [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Löschen', style: 'destructive', onPress: () => removeRule(rule.id) },
              ])
            }
            style={styles.delete}
          >
            <Text style={{ color: palette.dangerRed }}>Löschen</Text>
          </Pressable>
        </View>
      ))}

      <CasinoButton label="+ Neue Regel" onPress={() => router.push('/rule/new')} />
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
  delete: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
});
