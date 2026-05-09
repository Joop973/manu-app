import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { spacing, text } from '@/theme';
import { Trade } from '@/types';

const TRADES: Trade[] = [
  'Heizung',
  'Elektrik',
  'Sanitär',
  'Maler',
  'Schreiner',
  'Dach',
  'Garten',
  'Reinigung',
  'Schädlingsbekämpfung',
  'Schornsteinfeger',
  'Sonstiges',
];

export default function NewCraftsmanScreen() {
  const router = useRouter();
  const addCraftsman = useAppStore((s) => s.addCraftsman);

  const [name, setName] = useState('');
  const [trade, setTrade] = useState<Trade>('Heizung');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>Handwerker mit One-Touch-Call (F-036)</Text>

      <Field label="Name *">
        <TextField value={name} onChangeText={setName} placeholder="z.B. Sanitär Schmidt" />
      </Field>
      <Field label="Gewerk">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {TRADES.map((t) => (
            <GoldChip key={t} label={t} selected={trade === t} onPress={() => setTrade(t)} />
          ))}
        </ScrollView>
      </Field>
      <Field label="Telefon">
        <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </Field>
      <Field label="E-Mail">
        <TextField value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </Field>
      <Field label="Website">
        <TextField value={website} onChangeText={setWebsite} autoCapitalize="none" />
      </Field>
      <Field label="Öffnungszeiten">
        <TextField value={hours} onChangeText={setHours} placeholder="z.B. Mo–Fr 8–17" />
      </Field>
      <Field label="Notizen">
        <TextField value={notes} onChangeText={setNotes} multiline />
      </Field>

      <View style={{ height: spacing.md }} />
      <CasinoButton
        label="Handwerker speichern"
        onPress={() => {
          if (!name.trim()) return Alert.alert('Name fehlt');
          addCraftsman({
            name: name.trim(),
            trade,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            website: website.trim() || undefined,
            hours: hours.trim() || undefined,
            notes: notes.trim() || undefined,
          });
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
});
