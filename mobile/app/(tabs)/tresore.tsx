import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { GoldChip } from '@/components/GoldChip';
import { MonthSlider } from '@/components/MonthSlider';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { addMonths, formatDateDe } from '@/lib/dates';
import { buildFixedTresor, buildRentTresor } from '@/lib/tresore';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

type Section = 'miete' | 'fix' | 'belege' | 'dokumente' | 'finanzen';

export default function TresoreScreen() {
  const router = useRouter();
  const bookings = useAppStore((s) => s.bookings);
  const categories = useAppStore((s) => s.categories);
  const receipts = useAppStore((s) => s.receipts);
  const documents = useAppStore((s) => s.documents);
  const goals = useAppStore((s) => s.goals);
  const subscriptions = useAppStore((s) => s.subscriptions);
  const contracts = useAppStore((s) => s.contracts);
  const assets = useAppStore((s) => s.assets);
  const liabilities = useAppStore((s) => s.liabilities);
  const investments = useAppStore((s) => s.investments);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);
  const removeDocument = useAppStore((s) => s.removeDocument);

  const [section, setSection] = useState<Section>('miete');

  const lastMonth = addMonths(currentMonth, -1);
  const rentBuckets = buildRentTresor(bookings, currentMonth, lastMonth);
  const fixBuckets = buildFixedTresor(bookings, categories, currentMonth, lastMonth);

  const netWorth = assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.balance, 0);
  const portfolioValue = investments.reduce((s, i) => s + (i.currentPrice ?? i.buyPrice) * i.shares, 0);

  return (
    <Screen scrollKey="tresore">
      <Text style={text.imperialHeadline}>Tresore</Text>

      <View style={styles.tabRow}>
        <GoldChip label="Miete" selected={section === 'miete'} onPress={() => setSection('miete')} />
        <GoldChip label="Fixkosten" selected={section === 'fix'} onPress={() => setSection('fix')} />
        <GoldChip label="Belege" selected={section === 'belege'} onPress={() => setSection('belege')} />
        <GoldChip label="Dokumente" selected={section === 'dokumente'} onPress={() => setSection('dokumente')} />
        <GoldChip label="Finanzen" selected={section === 'finanzen'} onPress={() => setSection('finanzen')} />
      </View>

      {(section === 'miete' || section === 'fix') && (
        <MonthSlider value={currentMonth} onChange={setCurrentMonth} />
      )}

      {section === 'miete' ? (
        rentBuckets.length === 0 ? (
          <EmptyState icon="💰" title="Keine Mieteinnahmen" />
        ) : (
          rentBuckets.map((b) => {
            const missing = b.hadLastMonth && !b.hasThisMonth;
            return (
              <View
                key={b.counterparty}
                style={[styles.card, shadows.card, missing && { borderColor: palette.dangerRed }]}
              >
                <View style={styles.rowSplit}>
                  <Text style={text.sectionTitle}>{b.counterparty}</Text>
                  <Text style={[text.amountMedium, { color: palette.successGreen }]}>
                    {formatEuro(b.sum)}
                  </Text>
                </View>
                <Text style={text.subhead}>
                  {b.count} Zahlung(en){missing ? ' · ⚠ diesen Monat keine Zahlung' : ''}
                </Text>
              </View>
            );
          })
        )
      ) : null}

      {section === 'fix' ? (
        fixBuckets.length === 0 ? (
          <EmptyState icon="🛡" title="Keine Fixkosten" />
        ) : (
          fixBuckets.map((b) => {
            const delta = b.sum - b.prevSum;
            return (
              <View key={b.categoryId} style={[styles.card, shadows.card]}>
                <View style={styles.rowSplit}>
                  <Text style={text.sectionTitle}>
                    {b.category?.emoji} {b.category?.label}
                  </Text>
                  <Text style={[text.amountMedium, { color: palette.dangerRed }]}>
                    {formatEuro(b.sum)}
                  </Text>
                </View>
                <Text style={text.subhead}>
                  {b.count} Buchung(en) · Vormonat: {formatEuro(b.prevSum)}
                  {delta !== 0 ? ` · ${delta > 0 ? '↑' : '↓'} ${formatEuro(Math.abs(delta))}` : ''}
                </Text>
              </View>
            );
          })
        )
      ) : null}

      {section === 'belege' ? (
        <>
          <CasinoButton label="📸 Neuen Beleg scannen" onPress={() => router.push('/receipt/scan')} />
          {receipts.length === 0 ? (
            <EmptyState icon="📄" title="Noch keine Belege" />
          ) : (
            receipts
              .slice()
              .reverse()
              .map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })}
                  style={[styles.card, shadows.card]}
                >
                  <View style={styles.rowSplit}>
                    <Text style={text.bodyBold} numberOfLines={1}>
                      {r.kind === 'image' ? '🖼' : r.kind === 'pdf' ? '📄' : '📑'} {r.filename}
                    </Text>
                    {r.hint?.amount !== undefined ? (
                      <Text style={[text.bodyBold, { color: palette.imperialGold }]}>
                        {formatEuro(r.hint.amount)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={text.caption}>
                    {formatDateDe(r.createdAt.slice(0, 10))}
                    {r.hint?.counterparty ? ` · ${r.hint.counterparty}` : ''}
                  </Text>
                </Pressable>
              ))
          )}
        </>
      ) : null}

      {section === 'dokumente' ? (
        <>
          <CasinoButton label="📑 Dokument hochladen" onPress={() => router.push('/document/new')} />
          {documents.length === 0 ? (
            <EmptyState icon="🗂" title="Noch keine Dokumente" />
          ) : (
            documents
              .slice()
              .reverse()
              .map((d) => (
                <View key={d.id} style={[styles.card, shadows.card]}>
                  <View style={styles.rowSplit}>
                    <Text style={text.bodyBold} numberOfLines={1}>
                      📑 {d.filename}
                    </Text>
                    <GoldChip compact label="Löschen" onPress={() => removeDocument(d.id)} />
                  </View>
                  <Text style={text.caption}>
                    {d.category}
                    {d.expiresAt ? ` · läuft ab am ${d.expiresAt}` : ''}
                  </Text>
                  {d.notes ? <Text style={text.subhead}>{d.notes}</Text> : null}
                </View>
              ))
          )}
        </>
      ) : null}

      {section === 'finanzen' ? (
        <View style={{ gap: spacing.md }}>
          <View style={[styles.card, shadows.card]}>
            <View style={styles.rowSplit}>
              <Text style={text.sectionTitle}>📊 Net Worth</Text>
              <Text
                style={[
                  text.amountMedium,
                  { color: netWorth >= 0 ? palette.successGreen : palette.dangerRed },
                ]}
              >
                {formatEuro(netWorth)}
              </Text>
            </View>
            <Text style={text.subhead}>{assets.length} Aktiva · {liabilities.length} Passiva</Text>
            <CasinoButton label="Öffnen ›" variant="ghost" onPress={() => router.push('/networth')} />
          </View>

          <View style={[styles.card, shadows.card]}>
            <View style={styles.rowSplit}>
              <Text style={text.sectionTitle}>📈 Investments</Text>
              <Text style={[text.amountMedium, { color: palette.imperialGold }]}>
                {formatEuro(portfolioValue)}
              </Text>
            </View>
            <Text style={text.subhead}>{investments.length} Position(en)</Text>
            <CasinoButton label="Öffnen ›" variant="ghost" onPress={() => router.push('/investments')} />
          </View>

          <View style={[styles.card, shadows.card]}>
            <View style={styles.rowSplit}>
              <Text style={text.sectionTitle}>🎯 Sparziele</Text>
              <Text style={text.bodyBold}>{goals.length}</Text>
            </View>
            <CasinoButton label="Öffnen ›" variant="ghost" onPress={() => router.push('/goals')} />
          </View>

          <View style={[styles.card, shadows.card]}>
            <View style={styles.rowSplit}>
              <Text style={text.sectionTitle}>📺 Abos</Text>
              <Text style={text.bodyBold}>{subscriptions.filter((s) => s.active).length}</Text>
            </View>
            <CasinoButton label="Öffnen ›" variant="ghost" onPress={() => router.push('/subscriptions')} />
          </View>

          <View style={[styles.card, shadows.card]}>
            <View style={styles.rowSplit}>
              <Text style={text.sectionTitle}>📜 Verträge</Text>
              <Text style={text.bodyBold}>{contracts.length}</Text>
            </View>
            <CasinoButton label="Öffnen ›" variant="ghost" onPress={() => router.push('/contracts')} />
          </View>

          <View style={[styles.card, shadows.card]}>
            <View style={styles.rowSplit}>
              <Text style={text.sectionTitle}>💼 Budgets</Text>
              <Text style={text.bodyBold}>—</Text>
            </View>
            <CasinoButton label="Öffnen ›" variant="ghost" onPress={() => router.push('/budgets')} />
          </View>

          <View style={[styles.card, shadows.card]}>
            <View style={styles.rowSplit}>
              <Text style={text.sectionTitle}>💸 Tilgungsplaner</Text>
              <Text style={text.bodyBold}>—</Text>
            </View>
            <CasinoButton label="Öffnen ›" variant="ghost" onPress={() => router.push('/debt')} />
          </View>

          <View style={[styles.card, shadows.card]}>
            <View style={styles.rowSplit}>
              <Text style={text.sectionTitle}>🤝 Splits</Text>
              <Text style={text.bodyBold}>—</Text>
            </View>
            <CasinoButton label="Öffnen ›" variant="ghost" onPress={() => router.push('/splits')} />
          </View>
        </View>
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
