import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-122 Bill-Splitting — eine Buchung auf mehrere Personen aufteilen.
 */
export default function SplitsScreen() {
  const splits = useAppStore((s) => s.splits);
  const bookings = useAppStore((s) => s.bookings);
  const addSplit = useAppStore((s) => s.addSplit);
  const updateSplit = useAppStore((s) => s.updateSplit);
  const removeSplit = useAppStore((s) => s.removeSplit);

  const [showForm, setShowForm] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [participants, setParticipants] = useState('');

  const recentBookings = bookings
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 20);

  const submit = () => {
    if (!bookingId) return Alert.alert('Buchung wählen');
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const names = participants.split(/[,;\n]/).map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return Alert.alert('Mindestens eine Person');
    const total = booking.amount;
    const share = total / (names.length + 1); // +1 für den User selbst
    addSplit({
      bookingId: booking.id,
      totalAmount: total,
      paidByMe: total,
      participants: names.map((n) => ({ name: n, share, settled: false })),
    });
    setBookingId(null);
    setParticipants('');
    setShowForm(false);
  };

  const togglePaid = (splitId: string, name: string) => {
    const s = splits.find((sp) => sp.id === splitId);
    if (!s) return;
    updateSplit(splitId, {
      participants: s.participants.map((p) =>
        p.name === name ? { ...p, settled: !p.settled } : p,
      ),
    });
  };

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Geteilte Rechnungen</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Wer schuldet wem wieviel? (F-122)
      </Text>

      <CasinoButton
        label={showForm ? 'Abbrechen' : '+ Rechnung teilen'}
        variant={showForm ? 'ghost' : 'gold'}
        onPress={() => setShowForm((s) => !s)}
      />

      {showForm ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Buchung wählen</Text>
          {recentBookings.map((b) => (
            <View
              key={b.id}
              style={[
                styles.bookingRow,
                bookingId === b.id && { borderColor: palette.imperialGold, backgroundColor: 'rgba(212,175,55,0.10)' },
              ]}
            >
              <Text style={text.body} onPress={() => setBookingId(b.id)}>
                {b.date} · {formatEuro(b.amount)} · {b.counterparty ?? '—'}
              </Text>
            </View>
          ))}
          <Field label="Personen (Komma-getrennt)">
            <TextField
              value={participants}
              onChangeText={setParticipants}
              placeholder="z.B. Tom, Anna, Lisa"
            />
          </Field>
          <CasinoButton label="Splitten" onPress={submit} />
        </View>
      ) : null}

      {splits.length === 0 ? (
        <EmptyState icon="🤝" title="Noch keine Splits" />
      ) : null}

      {splits.map((s) => {
        const booking = bookings.find((b) => b.id === s.bookingId);
        const owedTotal = s.participants
          .filter((p) => !p.settled)
          .reduce((sum, p) => sum + p.share, 0);
        return (
          <View key={s.id} style={[styles.card, shadows.card]}>
            <View style={styles.row}>
              <Text style={text.bodyBold}>
                {booking?.counterparty ?? booking?.note ?? 'Buchung'}
              </Text>
              <Text style={text.bodyBold}>{formatEuro(s.totalAmount)}</Text>
            </View>
            <Text style={text.caption}>
              Offen: {formatEuro(owedTotal)} von {s.participants.length} Personen
            </Text>
            {s.participants.map((p) => (
              <View key={p.name} style={styles.participant}>
                <Text style={text.body}>
                  {p.settled ? '✓' : '⬜'} {p.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text
                    style={[
                      text.bodyBold,
                      { color: p.settled ? palette.successGreen : palette.imperialGold },
                    ]}
                  >
                    {formatEuro(p.share)}
                  </Text>
                  <CasinoButton
                    label={p.settled ? '↩' : '✓'}
                    variant="ghost"
                    style={{ width: 50, height: 36 }}
                    onPress={() => togglePaid(s.id, p.name)}
                  />
                </View>
              </View>
            ))}
            <CasinoButton
              label="🗑 Split löschen"
              variant="ghost"
              onPress={() => removeSplit(s.id)}
            />
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
  bookingRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    marginBottom: 6,
  },
  participant: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
