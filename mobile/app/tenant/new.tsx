import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { spacing } from '@/theme';

export default function NewTenantScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const addTenant = useAppStore((s) => s.addTenant);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [unit, setUnit] = useState('');
  const [rentCold, setRentCold] = useState('');
  const [rentWarm, setRentWarm] = useState('');
  const [deposit, setDeposit] = useState('');
  const [depositPaid, setDepositPaid] = useState(false);
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [notes, setNotes] = useState('');

  const num = (s: string) => {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <Screen>
      <Field label="Name *">
        <TextField value={name} onChangeText={setName} placeholder="z.B. Müller" />
      </Field>
      <Field label="Telefon">
        <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </Field>
      <Field label="E-Mail">
        <TextField value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </Field>
      {properties.length > 0 ? (
        <Field label="Objekt">
          <PropertyPicker value={propertyId} properties={properties} onChange={setPropertyId} />
        </Field>
      ) : null}
      <Field label="Wohneinheit">
        <TextField value={unit} onChangeText={setUnit} placeholder="z.B. EG links" />
      </Field>
      <Field label="Kaltmiete (€)">
        <TextField value={rentCold} onChangeText={setRentCold} keyboardType="numbers-and-punctuation" />
      </Field>
      <Field label="Warmmiete (€)">
        <TextField value={rentWarm} onChangeText={setRentWarm} keyboardType="numbers-and-punctuation" />
      </Field>
      <Field label="Kaution (€)">
        <TextField value={deposit} onChangeText={setDeposit} keyboardType="numbers-and-punctuation" />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <GoldChip label="Bezahlt" selected={depositPaid} onPress={() => setDepositPaid(true)} />
          <GoldChip label="Offen" selected={!depositPaid} onPress={() => setDepositPaid(false)} />
        </View>
      </Field>
      <Field label="Vertragsbeginn (YYYY-MM-DD)">
        <TextField value={contractStart} onChangeText={setContractStart} autoCapitalize="none" />
      </Field>
      <Field label="Vertragsende (optional)">
        <TextField value={contractEnd} onChangeText={setContractEnd} autoCapitalize="none" />
      </Field>
      <Field label="Notizen">
        <TextField value={notes} onChangeText={setNotes} multiline />
      </Field>

      <CasinoButton
        label="Mieter anlegen"
        onPress={() => {
          if (!name.trim()) return Alert.alert('Name fehlt');
          addTenant({
            name: name.trim(),
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            propertyId,
            unit: unit.trim() || undefined,
            rentCold: num(rentCold),
            rentWarm: num(rentWarm),
            deposit: num(deposit),
            depositPaid,
            contractStart: contractStart.trim() || undefined,
            contractEnd: contractEnd.trim() || undefined,
            notes: notes.trim() || undefined,
          });
          router.back();
        }}
      />
    </Screen>
  );
}
