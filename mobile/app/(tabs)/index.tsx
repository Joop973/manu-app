import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ALL_SECTION_IDS, renderSection } from '@/components/DashboardSections';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { palette, shadows } from '@/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const order = useAppStore((s) => s.dashboardOrder);
  const hidden = useAppStore((s) => s.dashboardHidden);

  // Falls neue Sektionen nach Update dazukommen, am Ende anhängen.
  const knownInOrder = order.filter((id) => ALL_SECTION_IDS.includes(id));
  const missing = ALL_SECTION_IDS.filter((id) => !knownInOrder.includes(id));
  const finalOrder = [...knownInOrder, ...missing].filter((id) => !hidden.includes(id));

  return (
    <View style={{ flex: 1 }}>
      <Screen scrollKey="dashboard">
        {finalOrder.map((id) => renderSection(id))}
        <Pressable
          onPress={() => router.push('/dashboard-edit')}
          style={({ pressed }) => [styles.editLink, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: palette.imperialGold, fontFamily: 'Lato_700Bold' }}>
            ⚙ Dashboard sortieren / ausblenden
          </Text>
        </Pressable>
      </Screen>

      <Pressable
        accessibilityLabel="Schnellerfassung"
        onPress={() => router.push('/booking/quick')}
        style={[styles.fab, shadows.goldChip]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  editLink: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.imperialGold,
    borderWidth: 3,
    borderColor: palette.imperialGoldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: { fontSize: 36, color: '#000', fontFamily: 'Lato_900Black', marginTop: -2 },
});
