import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { formatEuro } from '@/lib/calc';
import { ensurePermission, scheduleFromContractDeadline } from '@/lib/notifications';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { Contract } from '@/types';

const CATEGORIES: Contract['category'][] = [
  'Strom',
  'Gas',
  'Internet',
  'Telefon',
  'Versicherung',
  'Streaming',
  'Sonstiges',
];

/**
 * F-108 Vertrags-Tracker mit Kündigungsfrist.
 */
export default function ContractsScreen() {
  const router = useRouter();
  const contracts = useAppStore((s) => s.contracts);
  const addContract = useAppStore((s) => s.addContract);
  const removeContract = useAppStore((s) => s.removeContract);
  const addReminder = useAppStore((s) => s.addReminder);
  const setNotifications = useAppStore((s) => s.setNotifications);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState<Contract['category']>('Versicherung');
  const [monthlyCost, setMonthlyCost] = useState('');
  const [earliestEndDate, setEarliestEndDate] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('90');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!label.trim()) return Alert.alert('Bezeichnung fehlt');
    const monthly = monthlyCost ? Number(monthlyCost.replace(',', '.')) : undefined;
    const noticeDays = Number(noticePeriodDays) || 90;
    const contract = addContract({
      label: label.trim(),
      vendor: vendor.trim() || undefined,
      category,
      monthlyCost: monthly,
      earliestEndDate: earliestEndDate.trim() || undefined,
      noticePeriodDays: noticeDays,
      notes: notes.trim() || undefined,
    });
    if (earliestEndDate.trim()) {
      const ok = await ensurePermission();
      if (ok) {
        const id = await scheduleFromContractDeadline({
          label: contract.label,
          earliestEndDate: contract.earliestEndDate!,
          noticeDays,
        });
        setNotifications(true);
        if (id) {
          addReminder({
            label: contract.label,
            date: contract.earliestEndDate!,
            kind: 'contract',
            targetId: contract.id,
            notificationId: id,
          });
        }
      }
    }
    setLabel('');
    setVendor('');
    setMonthlyCost('');
    setEarliestEndDate('');
    setNotes('');
    setShowForm(false);
  };

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Verträge</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Kündigungsfristen lokal überwachen (F-108)
      </Text>

      <CasinoButton
        label={showForm ? 'Abbrechen' : '+ Neuer Vertrag'}
        variant={showForm ? 'ghost' : 'gold'}
        onPress={() => setShowForm((s) => !s)}
      />

      {showForm ? (
        <View style={[styles.card, shadows.card]}>
          <Field label="Bezeichnung *">
            <TextField value={label} onChangeText={setLabel} placeholder="z.B. Hausratversicherung" />
          </Field>
          <Field label="Anbieter">
            <TextField value={vendor} onChangeText={setVendor} placeholder="z.B. Allianz" />
          </Field>
          <Field label="Kategorie">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {CATEGORIES.map((c) => (
                <GoldChip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </ScrollView>
          </Field>
          <Field label="Monatliche Kosten (€)">
            <TextField value={monthlyCost} onChangeText={setMonthlyCost} keyboardType="numbers-and-punctuation" />
          </Field>
          <Field label="Frühestes Vertragsende (YYYY-MM-DD)">
            <TextField value={earliestEndDate} onChangeText={setEarliestEndDate} placeholder="z.B. 2026-12-31" />
          </Field>
          <Field label="Kündigungsfrist (Tage)">
            <TextField value={noticePeriodDays} onChangeText={setNoticePeriodDays} keyboardType="number-pad" />
          </Field>
          <Field label="Notizen">
            <TextField value={notes} onChangeText={setNotes} multiline />
          </Field>
          <CasinoButton label="Vertrag speichern" onPress={submit} />
        </View>
      ) : null}

      {contracts.length === 0 ? (
        <EmptyState icon="📜" title="Noch keine Verträge" />
      ) : null}

      {contracts.map((c) => {
        const deadline = c.earliestEndDate ? new Date(c.earliestEndDate) : null;
        const noticeDate = deadline
          ? new Date(deadline.getTime() - (c.noticePeriodDays ?? 90) * 86400000)
          : null;
        const today = new Date();
        const daysToNotice = noticeDate
          ? Math.ceil((noticeDate.getTime() - today.getTime()) / 86400000)
          : null;
        const tint =
          daysToNotice !== null && daysToNotice < 30 ? palette.dangerRed : palette.imperialGold;
        return (
          <View key={c.id} style={[styles.card, shadows.card, { borderColor: tint }]}>
            <View style={styles.row}>
              <Text style={text.bodyBold}>{c.label}</Text>
              {c.monthlyCost ? (
                <Text style={text.bodyBold}>{formatEuro(c.monthlyCost)}/Mt</Text>
              ) : null}
            </View>
            <Text style={text.caption}>
              {c.category}
              {c.vendor ? ` · ${c.vendor}` : ''}
            </Text>
            {deadline ? (
              <Text style={[text.body, { color: tint }]}>
                Vertragsende: {c.earliestEndDate} · Kündigung bis{' '}
                {noticeDate?.toISOString().slice(0, 10)}
                {daysToNotice !== null && daysToNotice >= 0
                  ? ` (in ${daysToNotice} Tg)`
                  : daysToNotice !== null
                    ? ' (Frist abgelaufen!)'
                    : ''}
              </Text>
            ) : null}
            {c.notes ? <Text style={text.subhead}>{c.notes}</Text> : null}
            <CasinoButton
              label="Löschen"
              variant="ghost"
              onPress={() =>
                Alert.alert('Vertrag löschen?', c.label, [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Löschen', style: 'destructive', onPress: () => removeContract(c.id) },
                ])
              }
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
});
