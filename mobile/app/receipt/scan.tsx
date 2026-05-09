import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { PropertyPicker } from '@/components/PropertyPicker';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { today } from '@/lib/dates';
import { success as hapticSuccess } from '@/lib/feedback';
import { parseReceipt } from '@/lib/parseReceipt';
import { readExtractableText, saveReceiptFile } from '@/lib/storage';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { Receipt, ReceiptHint, ReceiptKind } from '@/types';

interface PickedFile {
  uri: string;
  name: string;
  kind: ReceiptKind;
}

const COUNTDOWN_SECONDS = 4;

export default function ReceiptScanScreen() {
  const router = useRouter();
  const properties = useAppStore((s) => s.properties);
  const categories = useAppStore((s) => s.categories);
  const addReceipt = useAppStore((s) => s.addReceipt);
  const addBooking = useAppStore((s) => s.addBooking);

  const [files, setFiles] = useState<PickedFile[]>([]);
  const [active, setActive] = useState<{
    file: PickedFile;
    saved: { uri: string; size: number };
    text: string;
    hint: ReceiptHint;
  } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [overrides, setOverrides] = useState<{
    amount?: string;
    date?: string;
    counterparty?: string;
    propertyId?: string | null;
    categoryId?: string | null;
  }>({});

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
  };

  useEffect(() => () => stopCountdown(), []);

  const pickPdfsAndDocs = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const picked: PickedFile[] = result.assets.map((a) => ({
      uri: a.uri,
      name: a.name,
      kind: a.mimeType === 'application/pdf' ? 'pdf' : 'document',
    }));
    setFiles((s) => [...s, ...picked]);
  };

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Berechtigung fehlt', 'Foto-Zugriff bitte in den Einstellungen erlauben.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const picked: PickedFile[] = result.assets.map((a, idx) => ({
      uri: a.uri,
      name: a.fileName ?? `beleg-${Date.now()}-${idx}.jpg`,
      kind: 'image',
    }));
    setFiles((s) => [...s, ...picked]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Kamera blockiert', 'Bitte Kamera in den Einstellungen erlauben.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    const a = result.assets[0];
    setFiles((s) => [
      ...s,
      { uri: a.uri, name: a.fileName ?? `beleg-${Date.now()}.jpg`, kind: 'image' },
    ]);
  };

  const startProcessing = async () => {
    if (files.length === 0) {
      Alert.alert('Keine Dateien', 'Bitte mindestens eine Datei auswählen.');
      return;
    }
    const next = files[0];
    const saved = await saveReceiptFile(next.uri, next.name);
    const extracted = await readExtractableText(saved.uri, next.name);
    const hint = parseReceipt({ filename: next.name, text: extracted });
    setActive({ file: next, saved, text: extracted, hint });
    setOverrides({
      amount: hint.amount?.toString().replace('.', ','),
      date: hint.date ?? today(),
      counterparty: hint.counterparty,
      propertyId: properties[0]?.id ?? null,
      categoryId: hint.categoryId,
    });

    // F-029: Auto-Eintrag wenn Confidence hoch
    if (hint.confidence >= 0.7 && hint.amount && hint.date) {
      let remaining = COUNTDOWN_SECONDS;
      setCountdown(remaining);
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          stopCountdown();
          confirm({
            amount: hint.amount!,
            date: hint.date!,
            counterparty: hint.counterparty,
            categoryId: hint.categoryId ?? null,
            propertyId: properties[0]?.id ?? null,
            saved,
            file: next,
            hint,
          });
        }
      }, 1000);
    }
  };

  const confirm = (input: {
    amount: number;
    date: string;
    counterparty?: string;
    categoryId: string | null;
    propertyId: string | null;
    saved: { uri: string; size: number };
    file: PickedFile;
    hint: ReceiptHint;
  }) => {
    const receipt: Receipt = addReceipt({
      filename: input.file.name,
      kind: input.file.kind,
      uri: input.saved.uri,
      size: input.saved.size,
      hint: input.hint,
    });
    addBooking({
      type: 'expense',
      amount: input.amount,
      date: input.date,
      propertyId: input.propertyId,
      categoryId: input.categoryId,
      counterparty: input.counterparty,
      recurrence: 'none',
      receiptId: receipt.id,
    });
    hapticSuccess();
    setFiles((s) => s.slice(1));
    setActive(null);
    setOverrides({});
    if (files.length <= 1) router.back();
  };

  const confirmManual = () => {
    if (!active) return;
    stopCountdown();
    const amount = Number((overrides.amount ?? '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Betrag fehlt', 'Bitte einen gültigen Betrag eingeben.');
      return;
    }
    confirm({
      amount,
      date: overrides.date ?? today(),
      counterparty: overrides.counterparty,
      categoryId: overrides.categoryId ?? null,
      propertyId: overrides.propertyId ?? null,
      saved: active.saved,
      file: active.file,
      hint: active.hint,
    });
  };

  const skipFile = () => {
    if (!active) return;
    stopCountdown();
    addReceipt({
      filename: active.file.name,
      kind: active.file.kind,
      uri: active.saved.uri,
      size: active.saved.size,
      hint: active.hint,
    });
    setFiles((s) => s.slice(1));
    setActive(null);
    setOverrides({});
  };

  if (active) {
    const { hint } = active;
    return (
      <Screen>
        <Text style={[text.subhead, { textAlign: 'center' }]}>
          {countdown > 0
            ? `Auto-Buchung in ${countdown} s … (tippen zum Stoppen)`
            : 'Felder prüfen und buchen'}
        </Text>

        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>📄 {active.file.name}</Text>
          <Text style={text.subhead}>
            Confidence: {(hint.confidence * 100).toFixed(0)} % · Quelle: {hint.parsedFrom}
          </Text>
        </View>

        <Field label="Betrag *">
          <TextField
            value={overrides.amount ?? ''}
            onChangeText={(t) => setOverrides((s) => ({ ...s, amount: t }))}
            keyboardType="numbers-and-punctuation"
          />
        </Field>

        <Field label="Datum">
          <TextField
            value={overrides.date ?? ''}
            onChangeText={(t) => setOverrides((s) => ({ ...s, date: t }))}
            placeholder="YYYY-MM-DD"
          />
        </Field>

        <Field label="Empfänger">
          <TextField
            value={overrides.counterparty ?? ''}
            onChangeText={(t) => setOverrides((s) => ({ ...s, counterparty: t }))}
          />
        </Field>

        {properties.length > 0 ? (
          <Field label="Objekt">
            <PropertyPicker
              value={overrides.propertyId ?? null}
              properties={properties}
              onChange={(id) => setOverrides((s) => ({ ...s, propertyId: id }))}
            />
          </Field>
        ) : null}

        <Field label="Kategorie">
          <CategoryPicker
            value={overrides.categoryId ?? null}
            categories={categories}
            onChange={(id) => setOverrides((s) => ({ ...s, categoryId: id }))}
          />
        </Field>

        <CasinoButton
          label={countdown > 0 ? `Auto-Buchung in ${countdown}s` : 'Beleg verbuchen'}
          onPress={() => {
            stopCountdown();
            confirmManual();
          }}
        />
        <CasinoButton label="Nur Beleg ablegen, später buchen" variant="ghost" onPress={skipFile} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Multi-Upload (F-030): Foto, PDF, Word — KI parst lokal aus Dateiname + Text
      </Text>

      <View style={styles.actionRow}>
        <CasinoButton label="📸 Foto" onPress={takePhoto} style={{ flex: 1 }} />
        <CasinoButton label="🖼 Galerie" onPress={pickImages} style={{ flex: 1 }} />
      </View>
      <CasinoButton label="📑 Dokumente / PDFs" onPress={pickPdfsAndDocs} />
      <CasinoButton label="📷 QR-Scanner (F-031)" variant="ghost" onPress={() => router.push('/receipt/qr')} />

      {files.length > 0 ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>{files.length} Datei(en) bereit</Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {files.map((f, i) => (
              <View key={`${f.uri}-${i}`} style={styles.fileRow}>
                <Text style={text.body} numberOfLines={1}>
                  {f.kind === 'image' ? '🖼' : f.kind === 'pdf' ? '📄' : '📑'} {f.name}
                </Text>
                <GoldChip
                  compact
                  label="✕"
                  onPress={() => setFiles((s) => s.filter((_, idx) => idx !== i))}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <CasinoButton
        label="🤖 Verarbeitung starten"
        variant="green"
        onPress={startProcessing}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: spacing.sm,
  },
});
