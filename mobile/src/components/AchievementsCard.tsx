import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS } from '@/lib/achievements';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-118 Achievements / Streaks — kompakte Anzeige fürs Dashboard.
 */
export function AchievementsCard() {
  const state = useAppStore((s) => s.achievements);
  const list = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: state.unlocked.includes(a.id) }));
  const unlockedCount = list.filter((a) => a.unlocked).length;

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.head}>
        <Text style={text.sectionTitle}>🏆 Achievements</Text>
        <Text style={[text.bodyBold, { color: palette.imperialGold }]}>
          {unlockedCount}/{ACHIEVEMENTS.length}
        </Text>
      </View>

      <View style={styles.streakRow}>
        <Text style={text.body}>
          🔥 Streak: <Text style={[text.bodyBold, { color: palette.imperialGold }]}>{state.streak}</Text>
        </Text>
        <Text style={text.body}>
          🎰 {state.totalBookings} Buchungen
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {list.map((a) => (
          <View
            key={a.id}
            style={[
              styles.badge,
              {
                backgroundColor: a.unlocked ? palette.imperialGold : 'rgba(212,175,55,0.05)',
                borderColor: a.unlocked ? palette.imperialGoldLight : palette.cardBorder,
                opacity: a.unlocked ? 1 : 0.4,
              },
            ]}
          >
            <Text style={{ fontSize: 22 }}>{a.emoji}</Text>
            <Text style={[styles.badgeTitle, { color: a.unlocked ? '#000' : palette.imperialGold }]} numberOfLines={1}>
              {a.title}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakRow: { flexDirection: 'row', gap: spacing.lg },
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  badge: {
    width: 84,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  badgeTitle: { fontFamily: 'Lato_700Bold', fontSize: 10, textAlign: 'center' },
});
