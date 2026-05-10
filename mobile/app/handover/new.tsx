import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { today } from '@/lib/dates';
import { exportHandoverPdf, saveHandoverPhoto } from '@/lib/handover';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { HandoverRoom } from '@/types';

const DEFAULT_ROOMS = ['Küche', 'Bad', 'Schlafzimmer', 'Wohnzimmer', 'Flur', 'Keller'];

/**
 * F-044 Übergabeprotokoll-Wizard.
 */
export default function NewHandoverScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const tenants = useAppStore((s) => s.tenants);
  const addHandover = useAppStore((s) => s.addHandover);

  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [kind, setKind] = useState<'einzug' | 'auszug'>('einzug');
  const [date, setDate] = useState(today());
  const [rooms, setRooms] = useState<HandoverRoom[]>(
    DEFAULT_ROOMS.map((name) => ({ name, condition: '', defects: [], photoUris: [] })),
  );
  const [keys, setKeys] = useState<{ type: string; count: number }[]>([{ type: 'Wohnungstür', count: 2 }]);
  const [notes, setNotes] = useState('');

  const tenantsForProperty = tenants.filter((t) => t.propertyId === propertyId);

  const updateRoom = (idx: number, patch: Partial<HandoverRoom>) =>
    setRooms((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addPhotoToRoom = async (idx: number) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Kamera blockiert');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;
    const saved = await saveHandoverPhoto(result.assets[0].uri);
    updateRoom(idx, { photoUris: [...rooms[idx].photoUris, saved] });
  };

  const addDefectToRoom = (idx: number) => {
    Alert.prompt?.('Mangel beschreiben', '', (val) => {
      if (val) updateRoom(idx, { defects: [...rooms[idx].defects, val] });
    });
  };

  const submit = async () => {
    if (!propertyId) return Alert.alert('Objekt fehlt');
    const protocol = addHandover({
      propertyId,
      tenantId: tenantId ?? undefined,
      kind,
      date,
      rooms,
      keys,
      notes: notes.trim() || undefined,
    });
    try {
      await exportHandoverPdf({
        protocol,
        property: properties.find((p) => p.id === propertyId),
        tenant: tenants.find((t) => t.id === tenantId),
      });
    } catch (e) {
      Alert.alert('PDF-Export fehlgeschlagen', String(e));
    }
    router.back();
  };

  if (properties.length === 0) {
    return <Screen><EmptyState icon="🏛" title="Lege erst ein Objekt an" /></Screen>;
  }

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Raum für Raum durchgehen, Fotos machen, PDF erstellen (F-044)
      </Text>

      <Field label="Art">
        <View style={styles.row}>
          <GoldChip label="Einzug" selected={kind === 'einzug'} onPress={() => setKind('einzug')} />
          <GoldChip label="Auszug" selected={kind === 'auszug'} onPress={() => setKind('auszug')} />
        </View>
      </Field>

      <Field label="Objekt">
        <PropertyPicker value={propertyId} properties={properties} onChange={setPropertyId} allowNone={false} />
      </Field>

      {tenantsForProperty.length > 0 ? (
        <Field label="Mieter">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <GoldChip label="—" selected={tenantId === null} onPress={() => setTenantId(null)} />
            {tenantsForProperty.map((t) => (
              <GoldChip key={t.id} label={t.name} selected={tenantId === t.id} onPress={() => setTenantId(t.id)} />
            ))}
          </ScrollView>
        </Field>
      ) : null}

      <Field label="Datum">
        <TextField value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      </Field>

      <Text style={text.sectionTitle}>Räume</Text>

      {rooms.map((room, idx) => (
        <View key={`${room.name}-${idx}`} style={[styles.card, shadows.card]}>
          <View style={styles.headerRow}>
            <Text style={text.bodyBold}>{room.name}</Text>
            <Pressable onPress={() => setRooms((rs) => rs.filter((_, i) => i !== idx))}>
              <Text style={{ color: palette.dangerRed }}>×</Text>
            </Pressable>
          </View>
          <Field label="Zustand">
            <TextField
              value={room.condition}
              onChangeText={(v) => updateRoom(idx, { condition: v })}
              multiline
              placeholder="z.B. einwandfrei, frisch gestrichen"
            />
          </Field>
          {room.defects.length > 0 ? (
            <View>
              <Text style={text.caption}>Mängel:</Text>
              {room.defects.map((d, i) => (
                <Text key={i} style={text.body}>· {d}</Text>
              ))}
            </View>
          ) : null}
          <View style={styles.row}>
            <CasinoButton
              label="+ Mangel"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => addDefectToRoom(idx)}
            />
            <CasinoButton
              label="📸 Foto"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => addPhotoToRoom(idx)}
            />
          </View>
          {room.photoUris.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {room.photoUris.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.thumb} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ))}

      <CasinoButton
        label="+ Raum hinzufügen"
        variant="ghost"
        onPress={() => {
          Alert.prompt?.('Name des Raums', '', (val) => {
            if (val) setRooms((rs) => [...rs, { name: val, condition: '', defects: [], photoUris: [] }]);
          });
        }}
      />

      <Text style={text.sectionTitle}>Schlüsselübergabe</Text>
      {keys.map((k, i) => (
        <View key={i} style={styles.row}>
          <TextField
            value={k.type}
            onChangeText={(v) => setKeys((ks) => ks.map((x, idx) => (idx === i ? { ...x, type: v } : x)))}
            style={{ flex: 2 }}
          />
          <TextField
            value={String(k.count)}
            onChangeText={(v) => {
              const n = Number(v) || 0;
              setKeys((ks) => ks.map((x, idx) => (idx === i ? { ...x, count: n } : x)));
            }}
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
          <Pressable onPress={() => setKeys((ks) => ks.filter((_, idx) => idx !== i))}>
            <Text style={{ color: palette.dangerRed, fontSize: 22 }}>×</Text>
          </Pressable>
        </View>
      ))}
      <CasinoButton
        label="+ Schlüssel-Typ"
        variant="ghost"
        onPress={() => setKeys((ks) => [...ks, { type: '', count: 1 }])}
      />

      <Field label="Notizen">
        <TextField value={notes} onChangeText={setNotes} multiline />
      </Field>

      <CasinoButton label="📄 Protokoll speichern + PDF" variant="gold" onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap', paddingVertical: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: radii.sm,
    backgroundColor: palette.royalBlueAccent,
  },
});
