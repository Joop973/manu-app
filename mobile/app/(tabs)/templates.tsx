import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function TemplatesScreen() {
  const router = useRouter();
  const templates = useAppStore((s) => s.templates);
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const bookFromTemplate = useAppStore((s) => s.bookFromTemplate);
  const removeTemplate = useAppStore((s) => s.removeTemplate);

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Vorlagen</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Ein Tipp = sofort gebucht (F-022)
      </Text>

      {templates.length === 0 ? (
        <EmptyState
          icon="🪙"
          title="Noch keine Vorlagen"
          description="Long-Press auf eine Buchung, um sie als Vorlage zu speichern — oder leg eine neue an."
        />
      ) : null}

      {templates.map((tpl) => {
        const property = properties.find((p) => p.id === tpl.propertyId);
        const category = categories.find((c) => c.id === tpl.categoryId);
        const isIncome = tpl.type === 'income';
        return (
          <View key={tpl.id} style={[styles.card, shadows.card]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={text.sectionTitle} numberOfLines={1}>{tpl.label}</Text>
                <Text style={text.subhead}>
                  {category ? `${category.emoji} ${category.label}` : '—'}
                  {property ? ` · ${property.name}` : ''}
                  {tpl.recurrence !== 'none' ? ` · ${tpl.recurrence === 'monthly' ? 'monatlich' : 'jährlich'}` : ''}
                </Text>
              </View>
              <Text
                style={[
                  text.amountMedium,
                  { color: isIncome ? palette.successGreen : palette.dangerRed },
                ]}
              >
                {isIncome ? '+' : '−'} {formatEuro(tpl.amount)}
              </Text>
            </View>
            <View style={styles.actions}>
              <CasinoButton
                label="Sofort buchen"
                variant={isIncome ? 'green' : 'red'}
                onPress={() => {
                  bookFromTemplate(tpl.id);
                }}
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={() =>
                  Alert.alert('Vorlage löschen?', tpl.label, [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Löschen', style: 'destructive', onPress: () => removeTemplate(tpl.id) },
                  ])
                }
                style={styles.delete}
              >
                <Text style={{ color: palette.dangerRed, fontSize: 22 }}>🗑️</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <CasinoButton label="+ Neue Vorlage" onPress={() => router.push('/template/new')} />
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
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  delete: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,48,44,0.08)',
  },
});
