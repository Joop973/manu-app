import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

const ENTITY_LABEL: Record<string, string> = {
  booking: '🎰 Buchung',
  tenant: '👤 Mieter',
  craftsman: '🔧 Handwerker',
  receipt: '📄 Beleg',
  document: '📑 Dokument',
  meterReading: '📊 Zählerstand',
  maintenance: '🛠 Wartung',
  subscription: '📺 Abo',
  contract: '📜 Vertrag',
  goal: '🎯 Sparziel',
  tag: '🏷 Tag',
};

/**
 * F-131 Papierkorb — gelöschte Entitäten 30 Tage wiederherstellbar.
 */
export default function TrashScreen() {
  const t = useT();
  const trash = useAppStore((s) => s.trash);
  const restore = useAppStore((s) => s.restoreFromTrash);
  const empty = useAppStore((s) => s.emptyTrash);
  const purge = useAppStore((s) => s.purgeOldTrash);

  const ageDays = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  return (
    <Screen scrollKey="trash">
      <Text style={text.imperialHeadline}>{t('trash.title')}</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>{t('trash.description')}</Text>

      {trash.length === 0 ? (
        <EmptyState icon="🗑" title={t('trash.empty')} />
      ) : null}

      {trash
        .slice()
        .sort((a, b) => (a.deletedAt > b.deletedAt ? -1 : 1))
        .map((entry) => {
          const days = ageDays(entry.deletedAt);
          const expiring = days >= 25;
          return (
            <View
              key={entry.id}
              style={[styles.card, shadows.card, expiring && { borderColor: palette.dangerRed }]}
            >
              <View style={styles.row}>
                <Text style={text.bodyBold}>{ENTITY_LABEL[entry.entityType] ?? entry.entityType}</Text>
                <Text style={[text.caption, expiring && { color: palette.dangerRed }]}>
                  {days} Tg alt
                </Text>
              </View>
              <Text style={text.caption}>
                {t('trash.deletedAt')}: {entry.deletedAt.slice(0, 10)}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <CasinoButton
                  label={t('common.restore')}
                  variant="green"
                  style={{ flex: 1 }}
                  onPress={() => restore(entry.id)}
                />
              </View>
            </View>
          );
        })}

      {trash.length > 0 ? (
        <CasinoButton
          label={t('common.permanently')}
          variant="red"
          onPress={() =>
            Alert.alert(t('common.permanently'), '', [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.delete'), style: 'destructive', onPress: () => empty() },
            ])
          }
        />
      ) : null}

      <CasinoButton
        label="Älter als 30 Tg automatisch entfernen"
        variant="ghost"
        onPress={() => {
          const removed = purge();
          Alert.alert('Bereinigt', `${removed} Eintrag/Einträge endgültig gelöscht`);
        }}
      />
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
