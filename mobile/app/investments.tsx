import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { InvestmentKind } from '@/types';

const KINDS: { value: InvestmentKind; label: string }[] = [
  { value: 'stock', label: 'Aktie' },
  { value: 'etf', label: 'ETF' },
  { value: 'fund', label: 'Fonds' },
  { value: 'crypto', label: 'Krypto' },
  { value: 'other', label: 'Sonstiges' },
];

/**
 * F-115 Investment-Portfolio — manuelle Eingabe + manueller NAV-Update.
 */
export default function InvestmentsScreen() {
  const investments = useAppStore((s) => s.investments);
  const addInvestment = useAppStore((s) => s.addInvestment);
  const updatePrice = useAppStore((s) => s.updateInvestmentPrice);
  const removeInvestment = useAppStore((s) => s.removeInvestment);

  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<InvestmentKind>('etf');
  const [shares, setShares] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');

  const totalValue = investments.reduce(
    (s, i) => s + (i.currentPrice ?? i.buyPrice) * i.shares,
    0,
  );
  const totalCost = investments.reduce((s, i) => s + i.buyPrice * i.shares, 0);
  const totalReturn = totalValue - totalCost;

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Investments</Text>

      <View style={[styles.summary, shadows.card]}>
        <Text style={text.caption}>Portfolio-Wert</Text>
        <Text style={text.amountLarge}>{formatEuro(totalValue)}</Text>
        <Text
          style={[
            text.bodyBold,
            { color: totalReturn >= 0 ? palette.successGreen : palette.dangerRed },
          ]}
        >
          {totalReturn >= 0 ? '+' : '−'} {formatEuro(Math.abs(totalReturn))}
          {totalCost > 0 ? ` (${((totalReturn / totalCost) * 100).toFixed(1)}%)` : ''}
        </Text>
      </View>

      <CasinoButton
        label={showForm ? 'Abbrechen' : '+ Position hinzufügen'}
        variant={showForm ? 'ghost' : 'gold'}
        onPress={() => setShowForm((s) => !s)}
      />

      {showForm ? (
        <View style={[styles.card, shadows.card]}>
          <Field label="Symbol">
            <TextField value={symbol} onChangeText={setSymbol} placeholder="z.B. VWRL" autoCapitalize="characters" />
          </Field>
          <Field label="Name">
            <TextField value={name} onChangeText={setName} placeholder="z.B. Vanguard FTSE All-World" />
          </Field>
          <Field label="Art">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {KINDS.map((k) => (
                <GoldChip key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />
              ))}
            </ScrollView>
          </Field>
          <Field label="Stück">
            <TextField value={shares} onChangeText={setShares} keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label="Einstandspreis pro Stück">
            <TextField value={buyPrice} onChangeText={setBuyPrice} keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label="Währung">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {['EUR', 'USD', 'GBP', 'CHF'].map((c) => (
                <GoldChip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </ScrollView>
          </Field>
          <CasinoButton
            label="Position speichern"
            onPress={() => {
              const sh = Number(shares.replace(',', '.'));
              const bp = Number(buyPrice.replace(',', '.'));
              if (!symbol || !Number.isFinite(sh) || !Number.isFinite(bp))
                return Alert.alert('Eingabe unvollständig');
              addInvestment({
                symbol: symbol.toUpperCase(),
                name: name.trim() || symbol.toUpperCase(),
                kind,
                shares: sh,
                buyPrice: bp,
                currency,
              });
              setSymbol('');
              setName('');
              setShares('');
              setBuyPrice('');
              setShowForm(false);
            }}
          />
        </View>
      ) : null}

      {investments.length === 0 ? (
        <EmptyState icon="📈" title="Noch keine Investments" />
      ) : null}

      {investments.map((i) => {
        const current = i.currentPrice ?? i.buyPrice;
        const value = current * i.shares;
        const cost = i.buyPrice * i.shares;
        const ret = value - cost;
        return (
          <View key={i.id} style={[styles.card, shadows.card]}>
            <View style={styles.row}>
              <Text style={text.bodyBold}>
                {i.symbol} · {i.name}
              </Text>
              <Text style={text.bodyBold}>{formatEuro(value)}</Text>
            </View>
            <Text style={text.caption}>
              {i.shares} × {formatEuro(current)} ({i.currency})
            </Text>
            <Text style={[text.caption, { color: ret >= 0 ? palette.successGreen : palette.dangerRed }]}>
              {ret >= 0 ? '+' : '−'} {formatEuro(Math.abs(ret))}
              {cost > 0 ? ` · ${((ret / cost) * 100).toFixed(1)}%` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <CasinoButton
                label="Kurs aktualisieren"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() =>
                  Alert.prompt
                    ? Alert.prompt('Aktueller Kurs', i.symbol, (v) => {
                        const num = Number(v.replace(',', '.'));
                        if (Number.isFinite(num)) updatePrice(i.id, num);
                      })
                    : null
                }
              />
              <CasinoButton
                label="🗑"
                variant="ghost"
                style={{ width: 60 }}
                onPress={() => removeInvestment(i.id)}
              />
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    alignItems: 'center',
  },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
});
