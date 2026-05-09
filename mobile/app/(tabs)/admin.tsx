import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { RuleCondition } from '@/types';

type Section = 'mieter' | 'handwerker' | 'vorlagen' | 'regeln' | 'zaehler';

function describeCondition(c: RuleCondition): string {
  switch (c.field) {
    case 'counterparty': return `Empfänger ⊃ "${c.value}"`;
    case 'note': return `Notiz ⊃ "${c.value}"`;
    case 'amountMin': return `Betrag ≥ ${c.value} €`;
    case 'amountMax': return `Betrag ≤ ${c.value} €`;
  }
}

export default function AdminScreen() {
  const router = useRouter();
  const tenants = useAppStore((s) => s.tenants);
  const craftsmen = useAppStore((s) => s.craftsmen);
  const templates = useAppStore((s) => s.templates);
  const rules = useAppStore((s) => s.rules);
  const meterReadings = useAppStore((s) => s.meterReadings);
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);

  const removeRule = useAppStore((s) => s.removeRule);
  const removeTemplate = useAppStore((s) => s.removeTemplate);
  const removeReading = useAppStore((s) => s.removeMeterReading);
  const bookFromTemplate = useAppStore((s) => s.bookFromTemplate);

  const [section, setSection] = useState<Section>('mieter');

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Verwaltung</Text>

      <View style={styles.tabRow}>
        <GoldChip label="Mieter" selected={section === 'mieter'} onPress={() => setSection('mieter')} />
        <GoldChip label="Handwerker" selected={section === 'handwerker'} onPress={() => setSection('handwerker')} />
        <GoldChip label="Vorlagen" selected={section === 'vorlagen'} onPress={() => setSection('vorlagen')} />
        <GoldChip label="Regeln" selected={section === 'regeln'} onPress={() => setSection('regeln')} />
        <GoldChip label="Zähler" selected={section === 'zaehler'} onPress={() => setSection('zaehler')} />
      </View>

      {section === 'mieter' ? (
        <>
          <CasinoButton label="+ Neuer Mieter" onPress={() => router.push('/tenant/new')} />
          {tenants.length === 0 ? (
            <EmptyState icon="👤" title="Noch keine Mieter" />
          ) : (
            tenants.map((t) => {
              const property = properties.find((p) => p.id === t.propertyId);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => router.push({ pathname: '/tenant/[id]', params: { id: t.id } })}
                  style={[styles.card, shadows.card]}
                >
                  <View style={styles.rowSplit}>
                    <Text style={text.bodyBold}>{t.name}</Text>
                    {t.rentCold !== undefined ? (
                      <Text style={[text.bodyBold, { color: palette.successGreen }]}>
                        {formatEuro(t.rentCold)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={text.caption}>
                    {property?.name ?? '—'}
                    {t.unit ? ` · ${t.unit}` : ''}
                  </Text>
                </Pressable>
              );
            })
          )}
        </>
      ) : null}

      {section === 'handwerker' ? (
        <>
          <CasinoButton label="+ Neuer Handwerker" onPress={() => router.push('/craftsman/new')} />
          {craftsmen.length === 0 ? (
            <EmptyState icon="🔧" title="Noch keine Handwerker" />
          ) : (
            craftsmen.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: '/craftsman/[id]', params: { id: c.id } })}
                style={[styles.card, shadows.card]}
              >
                <View style={styles.rowSplit}>
                  <Text style={text.bodyBold}>{c.name}</Text>
                  <Text style={text.caption}>{c.trade}</Text>
                </View>
                {c.phone ? <Text style={text.subhead}>📞 {c.phone}</Text> : null}
              </Pressable>
            ))
          )}
        </>
      ) : null}

      {section === 'vorlagen' ? (
        <>
          <CasinoButton label="+ Neue Vorlage" onPress={() => router.push('/template/new')} />
          {templates.length === 0 ? (
            <EmptyState icon="🪙" title="Noch keine Vorlagen" />
          ) : (
            templates.map((tpl) => {
              const property = properties.find((p) => p.id === tpl.propertyId);
              const cat = categories.find((c) => c.id === tpl.categoryId);
              return (
                <View key={tpl.id} style={[styles.card, shadows.card]}>
                  <View style={styles.rowSplit}>
                    <Text style={text.bodyBold}>{tpl.label}</Text>
                    <Text
                      style={[
                        text.bodyBold,
                        { color: tpl.type === 'income' ? palette.successGreen : palette.dangerRed },
                      ]}
                    >
                      {tpl.type === 'income' ? '+' : '−'} {formatEuro(tpl.amount)}
                    </Text>
                  </View>
                  <Text style={text.caption}>
                    {cat ? `${cat.emoji} ${cat.label}` : '—'}
                    {property ? ` · ${property.name}` : ''}
                    {tpl.recurrence !== 'none'
                      ? ` · ${tpl.recurrence === 'monthly' ? 'monatlich' : 'jährlich'}`
                      : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <CasinoButton
                      label="Sofort buchen"
                      variant={tpl.type === 'income' ? 'green' : 'red'}
                      onPress={() => bookFromTemplate(tpl.id)}
                      style={{ flex: 1 }}
                    />
                    <CasinoButton
                      label="🗑"
                      variant="ghost"
                      onPress={() => removeTemplate(tpl.id)}
                      style={{ width: 56 }}
                    />
                  </View>
                </View>
              );
            })
          )}
        </>
      ) : null}

      {section === 'regeln' ? (
        <>
          <CasinoButton label="+ Neue Regel" onPress={() => router.push('/rule/new')} />
          {rules.length === 0 ? (
            <EmptyState icon="⚙️" title="Noch keine Regeln" />
          ) : (
            rules.map((rule) => (
              <View key={rule.id} style={[styles.card, shadows.card]}>
                <Text style={text.bodyBold}>{rule.label}</Text>
                {rule.conditions.map((c, i) => (
                  <Text key={i} style={text.subhead}>· {describeCondition(c)}</Text>
                ))}
                <CasinoButton
                  label="Löschen"
                  variant="ghost"
                  onPress={() => removeRule(rule.id)}
                />
              </View>
            ))
          )}
        </>
      ) : null}

      {section === 'zaehler' ? (
        <>
          <CasinoButton label="+ Zählerstand" onPress={() => router.push('/reading/new')} />
          {meterReadings.length === 0 ? (
            <EmptyState icon="📊" title="Noch keine Zählerstände" />
          ) : (
            meterReadings
              .slice()
              .reverse()
              .map((r) => {
                const property = properties.find((p) => p.id === r.propertyId);
                return (
                  <View key={r.id} style={[styles.card, shadows.card]}>
                    <View style={styles.rowSplit}>
                      <Text style={text.bodyBold}>
                        {r.type === 'strom' ? '⚡' : r.type === 'gas' ? '🔥' : r.type === 'wasser' ? '💧' : '♨️'}{' '}
                        {r.value} {r.unit}
                      </Text>
                      <Text style={text.caption}>{r.date}</Text>
                    </View>
                    <Text style={text.subhead}>{property?.name ?? '—'}</Text>
                    <CasinoButton
                      label="Löschen"
                      variant="ghost"
                      onPress={() => removeReading(r.id)}
                    />
                  </View>
                );
              })
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: 6,
  },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
