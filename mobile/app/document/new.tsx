import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { saveDocumentFile } from '@/lib/storage';
import { useAppStore } from '@/store/useAppStore';
import { spacing, text } from '@/theme';
import { DocumentCategory } from '@/types';

const CATEGORIES: DocumentCategory[] = [
  'Mietvertrag',
  'Versicherungspolice',
  'Grundbuchauszug',
  'Nebenkostenabrechnung',
  'Handwerker-Rechnung',
  'Sonstiges',
];

export default function NewDocumentScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const tenants = useAppStore((s) => s.tenants);
  const addDocument = useAppStore((s) => s.addDocument);

  const [picked, setPicked] = useState<{ uri: string; name: string } | null>(null);
  const [category, setCategory] = useState<DocumentCategory>('Mietvertrag');
  const [propertyId, setPropertyId] = useState<string | null>(properties[0]?.id ?? null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const a = result.assets[0];
    setPicked({ uri: a.uri, name: a.name });
  };

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Dokumenten-Tresor (F-043) — verschlüsselt im Gerät abgelegt
      </Text>

      {picked ? (
        <Field label="Datei">
          <Text style={text.bodyBold}>📄 {picked.name}</Text>
        </Field>
      ) : null}
      <CasinoButton label={picked ? '🔁 Andere Datei wählen' : '📑 Datei auswählen'} onPress={pick} />

      <Field label="Kategorie">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {CATEGORIES.map((c) => (
            <GoldChip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      </Field>

      {properties.length > 0 ? (
        <Field label="Objekt">
          <PropertyPicker value={propertyId} properties={properties} onChange={setPropertyId} />
        </Field>
      ) : null}

      {tenants.length > 0 ? (
        <Field label="Mieter (optional)">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <GoldChip label="—" selected={tenantId === null} onPress={() => setTenantId(null)} />
            {tenants.map((t) => (
              <GoldChip
                key={t.id}
                label={t.name}
                selected={tenantId === t.id}
                onPress={() => setTenantId(t.id)}
              />
            ))}
          </ScrollView>
        </Field>
      ) : null}

      <Field label="Ablaufdatum (optional)">
        <TextField value={expiresAt} onChangeText={setExpiresAt} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="Notiz">
        <TextField value={notes} onChangeText={setNotes} multiline />
      </Field>

      <View style={{ height: spacing.md }} />
      <CasinoButton
        label="Im Tresor ablegen"
        onPress={async () => {
          if (!picked) return Alert.alert('Keine Datei', 'Bitte zuerst eine Datei wählen.');
          const saved = await saveDocumentFile(picked.uri, picked.name);
          addDocument({
            filename: picked.name,
            uri: saved.uri,
            size: saved.size,
            category,
            propertyId,
            tenantId,
            expiresAt: expiresAt.trim() || undefined,
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
