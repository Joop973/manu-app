import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { computeBruttoNetto, PAUSCHALBETRAEGE, TaxClass } from '@/lib/bruttoNetto';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-121 Brutto-Netto-Rechner + Pauschalbeträge.
 */
export default function BruttoNettoScreen() {
  const [brutto, setBrutto] = useState('3500');
  const [taxClass, setTaxClass] = useState<TaxClass>(1);
  const [children, setChildren] = useState('0');
  const [church, setChurch] = useState('0');
  const [privateHealth, setPrivateHealth] = useState(false);

  const result = useMemo(() => {
    const b = Number(brutto.replace(',', '.'));
    if (!Number.isFinite(b) || b <= 0) return null;
    return computeBruttoNetto({
      monthlyGross: b,
      taxClass,
      childrenAllowance: Number(children) || 0,
      churchTaxPercent: Number(church) || 0,
      privateHealthInsurance: privateHealth,
      state: 'andere',
    });
  }, [brutto, taxClass, children, church, privateHealth]);

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Brutto / Netto</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Schätzung 2026 — keine rechtsverbindliche Aussage (F-121)
      </Text>

      <Field label="Monats-Brutto (€)">
        <TextField value={brutto} onChangeText={setBrutto} keyboardType="numbers-and-punctuation" />
      </Field>

      <Field label="Steuerklasse">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[1, 2, 3, 4, 5, 6].map((c) => (
            <GoldChip
              key={c}
              label={`Klasse ${c}`}
              selected={taxClass === c}
              onPress={() => setTaxClass(c as TaxClass)}
            />
          ))}
        </ScrollView>
      </Field>

      <Field label="Kinderfreibeträge">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {['0', '0.5', '1', '1.5', '2', '3'].map((c) => (
            <GoldChip key={c} label={c} selected={children === c} onPress={() => setChildren(c)} />
          ))}
        </ScrollView>
      </Field>

      <Field label="Kirchensteuer">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <GoldChip label="0%" selected={church === '0'} onPress={() => setChurch('0')} />
          <GoldChip label="8%" selected={church === '8'} onPress={() => setChurch('8')} />
          <GoldChip label="9%" selected={church === '9'} onPress={() => setChurch('9')} />
        </ScrollView>
      </Field>

      <View style={styles.toggleRow}>
        <Text style={text.body}>Privat krankenversichert</Text>
        <Switch
          value={privateHealth}
          onValueChange={setPrivateHealth}
          trackColor={{ true: palette.imperialGold, false: palette.royalBlueAccent }}
          thumbColor={palette.marbleWhite}
        />
      </View>

      {result ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Ergebnis</Text>
          <Row label="Brutto" value={formatEuro(result.brutto)} />
          <Row label="Lohnsteuer" value={`− ${formatEuro(result.einkommensteuer)}`} />
          <Row label="Solidaritätszuschlag" value={`− ${formatEuro(result.solidaritaetszuschlag)}`} />
          <Row label="Kirchensteuer" value={`− ${formatEuro(result.kirchensteuer)}`} />
          <Row label="Rentenversicherung" value={`− ${formatEuro(result.rentenversicherung)}`} />
          <Row label="Arbeitslosenversicherung" value={`− ${formatEuro(result.arbeitslosenversicherung)}`} />
          <Row label="Krankenversicherung" value={`− ${formatEuro(result.krankenversicherung)}`} />
          <Row label="Pflegeversicherung" value={`− ${formatEuro(result.pflegeversicherung)}`} />
          <View style={styles.divider} />
          <Row
            label="Netto"
            value={formatEuro(result.netto)}
            highlight
          />
          <Text style={text.caption}>
            Effektive Abzugsquote: {(result.effektiveSteuerquote * 100).toFixed(1)}%
          </Text>
        </View>
      ) : null}

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>Pauschalbeträge 2026 (Schätzung)</Text>
        <Row label="Arbeitnehmer-Pauschbetrag" value={formatEuro(PAUSCHALBETRAEGE.arbeitnehmerPauschbetrag)} />
        <Row label="Sparer-Pauschbetrag" value={formatEuro(PAUSCHALBETRAEGE.sparerPauschbetrag)} />
        <Row label="Alleinerziehende" value={formatEuro(PAUSCHALBETRAEGE.alleinerziehende)} />
        <Row label="Haushaltsnahe Dienstleistungen (max.)" value={formatEuro(PAUSCHALBETRAEGE.haushaltsnahDienstleistung)} />
        <Row label="Handwerkerleistungen (max.)" value={formatEuro(PAUSCHALBETRAEGE.handwerkerleistung)} />
      </View>
    </Screen>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.kvRow}>
      <Text style={text.body}>{label}</Text>
      <Text
        style={[
          highlight ? text.amountMedium : text.bodyBold,
          highlight ? { color: palette.successGreen } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: palette.cardBorder, marginVertical: 4 },
});
