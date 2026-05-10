import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { ColorPicker } from '@/components/ColorPicker';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { spacing, text } from '@/theme';
import { objectColors } from '@/theme/colors';

export default function NewTagScreen() {
  const router = useRouter();
  const addTag = useAppStore((s) => s.addTag);
  const used = new Set(useAppStore((s) => s.tags).map((t) => t.color));
  const initialColor = objectColors.find((c) => !used.has(c)) ?? objectColors[0];

  const [label, setLabel] = useState('');
  const [color, setColor] = useState<string>(initialColor);

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Tags ergänzen Kategorien (z.B. „Steuerrelevant", „Renovierung 2026")
      </Text>

      <Field label="Name *">
        <TextField value={label} onChangeText={setLabel} placeholder="z.B. Steuerrelevant" />
      </Field>
      <Field label="Farbe">
        <ColorPicker value={color} onChange={setColor} />
      </Field>

      <View style={{ height: spacing.md }} />
      <CasinoButton
        label="Tag anlegen"
        onPress={() => {
          if (!label.trim()) return Alert.alert('Name fehlt');
          addTag({ label: label.trim().replace(/^#/, ''), color });
          router.back();
        }}
      />
    </Screen>
  );
}
