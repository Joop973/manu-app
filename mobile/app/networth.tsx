import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { computeNetWorth } from '@/lib/networth';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { AssetKind, LiabilityKind } from '@/types';

const ASSET_KINDS: { value: AssetKind; label: string; emoji: string }[] = [
  { value: 'cash', label: 'Konto / Cash', emoji: '💰' },
  { value: 'property', label: 'Immobilie', emoji: '🏛' },
  { value: 'investment', label: 'Investment', emoji: '📈' },
  { value: 'vehicle', label: 'Fahrzeug', emoji: '🚗' },
  { value: 'other', label: 'Sonstiges', emoji: '✨' },
];

const LIABILITY_KINDS: { value: LiabilityKind; label: string; emoji: string }[] = [
  { value: 'mortgage', label: 'Hypothek', emoji: '🏗' },
  { value: 'loan', label: 'Darlehen', emoji: '💸' },
  { value: 'credit_card', label: 'Kreditkarte', emoji: '💳' },
  { value: 'other', label: 'Sonstiges', emoji: '📄' },
];

/**
 * F-112 Net Worth Tracker.
 */
export default function NetWorthScreen() {
  const assets = useAppStore((s) => s.assets);
  const liabilities = useAppStore((s) => s.liabilities);
  const addAsset = useAppStore((s) => s.addAsset);
  const updateAssetValue = useAppStore((s) => s.updateAssetValue);
  const removeAsset = useAppStore((s) => s.removeAsset);
  const addLiability = useAppStore((s) => s.addLiability);
  const updateLiabilityBalance = useAppStore((s) => s.updateLiabilityBalance);
  const removeLiability = useAppStore((s) => s.removeLiability);

  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showLiabForm, setShowLiabForm] = useState(false);

  const [assetLabel, setAssetLabel] = useState('');
  const [assetValue, setAssetValue] = useState('');
  const [assetKind, setAssetKind] = useState<AssetKind>('cash');

  const [liabLabel, setLiabLabel] = useState('');
  const [liabBalance, setLiabBalance] = useState('');
  const [liabKind, setLiabKind] = useState<LiabilityKind>('mortgage');
  const [liabRate, setLiabRate] = useState('');

  const snap = computeNetWorth(assets, liabilities);

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Net Worth</Text>

      <View style={[styles.summary, shadows.card]}>
        <Text style={text.caption}>Vermögen</Text>
        <Text
          style={[
            text.amountLarge,
            { color: snap.netWorth >= 0 ? palette.successGreen : palette.dangerRed },
          ]}
        >
          {formatEuro(snap.netWorth)}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={text.caption}>Aktiva</Text>
            <Text style={[text.amountMedium, { color: palette.successGreen }]}>
              {formatEuro(snap.totalAssets)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={text.caption}>Passiva</Text>
            <Text style={[text.amountMedium, { color: palette.dangerRed }]}>
              {formatEuro(snap.totalLiabilities)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={text.sectionTitle}>Aktiva ({assets.length})</Text>
      <CasinoButton
        label={showAssetForm ? 'Abbrechen' : '+ Aktivum'}
        variant={showAssetForm ? 'ghost' : 'gold'}
        onPress={() => setShowAssetForm((s) => !s)}
      />
      {showAssetForm ? (
        <View style={[styles.card, shadows.card]}>
          <Field label="Bezeichnung">
            <TextField value={assetLabel} onChangeText={setAssetLabel} placeholder="z.B. Girokonto DKB" />
          </Field>
          <Field label="Wert (€)">
            <TextField
              value={assetValue}
              onChangeText={setAssetValue}
              keyboardType="numbers-and-punctuation"
            />
          </Field>
          <Field label="Art">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {ASSET_KINDS.map((k) => (
                <GoldChip
                  key={k.value}
                  label={`${k.emoji} ${k.label}`}
                  selected={assetKind === k.value}
                  onPress={() => setAssetKind(k.value)}
                />
              ))}
            </ScrollView>
          </Field>
          <CasinoButton
            label="Aktivum speichern"
            onPress={() => {
              const v = Number(assetValue.replace(',', '.'));
              if (!assetLabel.trim() || !Number.isFinite(v)) return Alert.alert('Eingabe unvollständig');
              addAsset({ label: assetLabel.trim(), kind: assetKind, value: v });
              setAssetLabel('');
              setAssetValue('');
              setShowAssetForm(false);
            }}
          />
        </View>
      ) : null}

      {assets.map((a) => (
        <View key={a.id} style={[styles.card, shadows.card]}>
          <View style={styles.row}>
            <Text style={text.bodyBold}>{a.label}</Text>
            <Text style={[text.bodyBold, { color: palette.successGreen }]}>{formatEuro(a.value)}</Text>
          </View>
          <Text style={text.caption}>{a.kind}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <CasinoButton
              label="Wert aktualisieren"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() =>
                Alert.prompt
                  ? Alert.prompt('Neuer Wert', a.label, (val) => {
                      const v = Number(val.replace(',', '.'));
                      if (Number.isFinite(v)) updateAssetValue(a.id, v);
                    })
                  : null
              }
            />
            <CasinoButton
              label="🗑"
              variant="ghost"
              style={{ width: 60 }}
              onPress={() => removeAsset(a.id)}
            />
          </View>
        </View>
      ))}

      <Text style={text.sectionTitle}>Passiva ({liabilities.length})</Text>
      <CasinoButton
        label={showLiabForm ? 'Abbrechen' : '+ Passivum'}
        variant={showLiabForm ? 'ghost' : 'red'}
        onPress={() => setShowLiabForm((s) => !s)}
      />
      {showLiabForm ? (
        <View style={[styles.card, shadows.card]}>
          <Field label="Bezeichnung">
            <TextField value={liabLabel} onChangeText={setLiabLabel} placeholder="z.B. Hypothek Südstraße" />
          </Field>
          <Field label="Restschuld (€)">
            <TextField
              value={liabBalance}
              onChangeText={setLiabBalance}
              keyboardType="numbers-and-punctuation"
            />
          </Field>
          <Field label="Zinssatz % (jährlich)">
            <TextField value={liabRate} onChangeText={setLiabRate} keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label="Art">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {LIABILITY_KINDS.map((k) => (
                <GoldChip
                  key={k.value}
                  label={`${k.emoji} ${k.label}`}
                  selected={liabKind === k.value}
                  onPress={() => setLiabKind(k.value)}
                />
              ))}
            </ScrollView>
          </Field>
          <CasinoButton
            label="Passivum speichern"
            onPress={() => {
              const b = Number(liabBalance.replace(',', '.'));
              if (!liabLabel.trim() || !Number.isFinite(b)) return Alert.alert('Eingabe unvollständig');
              addLiability({
                label: liabLabel.trim(),
                kind: liabKind,
                balance: b,
                interestRate: liabRate ? Number(liabRate.replace(',', '.')) : undefined,
              });
              setLiabLabel('');
              setLiabBalance('');
              setLiabRate('');
              setShowLiabForm(false);
            }}
          />
        </View>
      ) : null}

      {liabilities.map((l) => (
        <View key={l.id} style={[styles.card, shadows.card]}>
          <View style={styles.row}>
            <Text style={text.bodyBold}>{l.label}</Text>
            <Text style={[text.bodyBold, { color: palette.dangerRed }]}>{formatEuro(l.balance)}</Text>
          </View>
          <Text style={text.caption}>
            {l.kind}
            {l.interestRate !== undefined ? ` · ${l.interestRate}% p.a.` : ''}
          </Text>
          <CasinoButton
            label="🗑 Löschen"
            variant="ghost"
            onPress={() => removeLiability(l.id)}
          />
        </View>
      ))}

      {assets.length === 0 && liabilities.length === 0 ? (
        <EmptyState icon="📊" title="Trag Aktiva + Passiva ein" description="Konten, Immobilien, Hypotheken — Manu rechnet daraus deine Vermögensbilanz." />
      ) : null}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
