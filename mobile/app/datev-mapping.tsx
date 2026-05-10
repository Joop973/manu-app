import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-042 DATEV-Konten-Mapping pro Kategorie.
 */
export default function DatevMappingScreen() {
  const categories = useAppStore((s) => s.categories);
  const mapping = useAppStore((s) => s.datevMapping);
  const setMapping = useAppStore((s) => s.setDatevMapping);
  const removeMapping = useAppStore((s) => s.removeDatevMapping);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [account, setAccount] = useState('');
  const [accountName, setAccountName] = useState('');

  const submit = () => {
    if (!categoryId) return Alert.alert('Kategorie wählen');
    if (!account.trim()) return Alert.alert('Konto-Nr. fehlt');
    setMapping(categoryId, account.trim(), accountName.trim() || undefined);
    setAccount('');
    setAccountName('');
    setCategoryId(null);
  };

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Verbinde Manu-Kategorien mit DATEV-Konten (z.B. Strom → 4240) (F-042)
      </Text>

      <View style={[styles.card, shadows.card]}>
        <Field label="Kategorie">
          <CategoryPicker value={categoryId} categories={categories} onChange={setCategoryId} />
        </Field>
        <Field label="DATEV-Kontonummer">
          <TextField value={account} onChangeText={setAccount} keyboardType="number-pad" placeholder="z.B. 4240" />
        </Field>
        <Field label="Bezeichnung (optional)">
          <TextField value={accountName} onChangeText={setAccountName} placeholder="z.B. Gas, Strom, Wasser" />
        </Field>
        <CasinoButton label="Mapping speichern" onPress={submit} />
      </View>

      <Text style={text.sectionTitle}>Aktive Mappings ({mapping.length})</Text>
      {mapping.length === 0 ? (
        <Text style={text.subhead}>Noch keine Mappings — Defaults: Einnahmen → 8400, Ausgaben → 4900.</Text>
      ) : null}
      {mapping.map((m) => {
        const cat = categories.find((c) => c.id === m.categoryId);
        return (
          <View key={m.categoryId} style={[styles.card, shadows.card]}>
            <View style={styles.row}>
              <Text style={text.bodyBold}>
                {cat ? `${cat.emoji} ${cat.label}` : m.categoryId}
              </Text>
              <Text style={[text.bodyBold, { color: palette.imperialGold }]}>{m.account}</Text>
            </View>
            {m.accountName ? <Text style={text.caption}>{m.accountName}</Text> : null}
            <CasinoButton label="🗑 Entfernen" variant="ghost" onPress={() => removeMapping(m.categoryId)} />
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
