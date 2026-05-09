import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { ColorPicker } from '@/components/ColorPicker';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { objectColors } from '@/theme/colors';
import { spacing, text } from '@/theme';

export default function NewPropertyScreen() {
  const router = useRouter();
  const addProperty = useAppStore((s) => s.addProperty);
  const usedColors = new Set(useAppStore((s) => s.properties).map((p) => p.color));
  const initialColor = objectColors.find((c) => !usedColors.has(c)) ?? objectColors[0];

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<string>(initialColor);

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Neues Objekt</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Imperium gründen — Name, Adresse, Hausfarbe
      </Text>

      <Field label="Name *">
        <TextField placeholder="z.B. Südstraße 12" value={name} onChangeText={setName} />
      </Field>
      <Field label="Adresse">
        <TextField placeholder="Straße, PLZ, Ort" value={address} onChangeText={setAddress} />
      </Field>
      <Field label="Notizen">
        <TextField
          placeholder="Beschreibung, Besonderheiten…"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </Field>
      <Field label="Hausfarbe (F-016)">
        <ColorPicker value={color} onChange={setColor} />
      </Field>

      <View style={{ height: spacing.md }} />

      <CasinoButton
        label="Anlegen"
        onPress={() => {
          if (!name.trim()) {
            Alert.alert('Name fehlt', 'Gib dem Objekt einen Namen.');
            return;
          }
          addProperty({ name: name.trim(), address, notes, color });
          router.back();
        }}
      />
    </Screen>
  );
}
