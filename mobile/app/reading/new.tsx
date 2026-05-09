import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { today } from '@/lib/dates';
import { saveReadingPhoto } from '@/lib/storage';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, spacing, text } from '@/theme';
import { MeterType } from '@/types';

const TYPES: { value: MeterType; label: string; emoji: string; unit: string }[] = [
  { value: 'strom', label: 'Strom', emoji: '⚡', unit: 'kWh' },
  { value: 'gas', label: 'Gas', emoji: '🔥', unit: 'm³' },
  { value: 'wasser', label: 'Wasser', emoji: '💧', unit: 'm³' },
  { value: 'heizung', label: 'Heizung', emoji: '♨️', unit: 'kWh' },
];

export default function NewReadingScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const addMeterReading = useAppStore((s) => s.addMeterReading);

  const [type, setType] = useState<MeterType>('strom');
  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today());
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const typeMeta = TYPES.find((t) => t.value === type)!;

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Kamera blockiert');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;
    const saved = await saveReadingPhoto(result.assets[0].uri);
    setPhoto(saved);
  };

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Zählerstand erfassen mit Foto-Beweis (F-046)
      </Text>

      <Field label="Typ">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {TYPES.map((t) => (
            <GoldChip
              key={t.value}
              label={`${t.emoji} ${t.label}`}
              selected={type === t.value}
              onPress={() => setType(t.value)}
            />
          ))}
        </ScrollView>
      </Field>

      {properties.length > 0 ? (
        <Field label="Objekt *">
          <PropertyPicker
            value={propertyId}
            properties={properties}
            onChange={setPropertyId}
            allowNone={false}
          />
        </Field>
      ) : null}

      <Field label={`Zählerstand (${typeMeta.unit})`}>
        <TextField value={value} onChangeText={setValue} keyboardType="numbers-and-punctuation" />
      </Field>

      <Field label="Ablesedatum">
        <TextField value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>

      <Field label="Foto-Nachweis">
        {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
        <CasinoButton
          label={photo ? '🔁 Foto neu' : '📸 Zähler fotografieren'}
          variant="ghost"
          onPress={takePhoto}
        />
      </Field>

      <Field label="Notiz">
        <TextField value={notes} onChangeText={setNotes} multiline />
      </Field>

      <View style={{ height: spacing.md }} />
      <CasinoButton
        label="Zählerstand speichern"
        onPress={() => {
          if (!propertyId) return Alert.alert('Objekt fehlt');
          const num = Number(value.replace(',', '.'));
          if (!Number.isFinite(num) || num < 0) return Alert.alert('Wert ungültig');
          addMeterReading({
            type,
            propertyId,
            value: num,
            unit: typeMeta.unit,
            date,
            photoUri: photo ?? undefined,
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
  photo: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
    backgroundColor: palette.royalBlueAccent,
    marginBottom: spacing.sm,
  },
});
