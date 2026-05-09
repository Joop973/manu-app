import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { deleteFile } from '@/lib/storage';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function ReceiptDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const receipt = useAppStore((s) => s.receipts.find((r) => r.id === id));
  const booking = useAppStore((s) => s.bookings.find((b) => b.receiptId === id));
  const removeReceipt = useAppStore((s) => s.removeReceipt);

  if (!receipt) {
    return <Screen><EmptyState icon="❓" title="Beleg nicht gefunden" /></Screen>;
  }

  const share = async () => {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(receipt.uri);
  };

  const deleteEntry = () => {
    Alert.alert('Beleg löschen?', receipt.filename, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteFile(receipt.uri);
          removeReceipt(receipt.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>{receipt.filename}</Text>
        <Text style={text.subhead}>
          {receipt.kind.toUpperCase()} · {(receipt.size ?? 0) / 1024 < 1024
            ? `${((receipt.size ?? 0) / 1024).toFixed(1)} KB`
            : `${((receipt.size ?? 0) / 1024 / 1024).toFixed(1)} MB`}
        </Text>
      </View>

      {receipt.kind === 'image' ? (
        <Image source={{ uri: receipt.uri }} style={styles.preview} resizeMode="contain" />
      ) : (
        <View style={[styles.placeholder, shadows.card]}>
          <Text style={{ fontSize: 60 }}>{receipt.kind === 'pdf' ? '📄' : '📑'}</Text>
        </View>
      )}

      {receipt.hint ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>KI-Erkennung</Text>
          <Text style={text.body}>
            Confidence: {(receipt.hint.confidence * 100).toFixed(0)} %{'\n'}
            Quelle: {receipt.hint.parsedFrom}
          </Text>
          {receipt.hint.amount !== undefined ? (
            <Text style={text.body}>Betrag: {formatEuro(receipt.hint.amount)}</Text>
          ) : null}
          {receipt.hint.date ? <Text style={text.body}>Datum: {receipt.hint.date}</Text> : null}
          {receipt.hint.counterparty ? (
            <Text style={text.body}>Empfänger: {receipt.hint.counterparty}</Text>
          ) : null}
        </View>
      ) : null}

      {booking ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Verbuchte Buchung</Text>
          <Text style={text.body}>
            {booking.type === 'income' ? '+' : '−'} {formatEuro(booking.amount)} · {booking.date}
          </Text>
          {booking.counterparty ? <Text style={text.body}>{booking.counterparty}</Text> : null}
        </View>
      ) : (
        <Text style={[text.subhead, { textAlign: 'center' }]}>
          Diesem Beleg ist noch keine Buchung zugeordnet.
        </Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <CasinoButton label="📤 Teilen" onPress={share} />
        <CasinoButton label="🗑 Löschen" variant="red" onPress={deleteEntry} />
      </ScrollView>
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
  preview: {
    width: '100%',
    height: 320,
    borderRadius: radii.lg,
    backgroundColor: palette.royalBlueAccent,
  },
  placeholder: {
    height: 200,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.royalBlue,
  },
});
