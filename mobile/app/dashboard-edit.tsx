import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ALL_SECTION_IDS, SECTION_META } from '@/components/DashboardSections';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

/**
 * F-005 Drag&Drop-Dashboard — Reorder + Sichtbarkeit pro Sektion.
 */
export default function DashboardEditScreen() {
  const router = useRouter();
  const orderFromStore = useAppStore((s) => s.dashboardOrder);
  const hidden = useAppStore((s) => s.dashboardHidden);
  const setOrder = useAppStore((s) => s.setDashboardOrder);
  const toggleHidden = useAppStore((s) => s.toggleDashboardSection);

  // Lokaler Drag-State (für flüssiges Sortieren ohne ständigen Persist-Write)
  const initial = (() => {
    const known = orderFromStore.filter((id) => ALL_SECTION_IDS.includes(id));
    const missing = ALL_SECTION_IDS.filter((id) => !known.includes(id));
    return [...known, ...missing];
  })();
  const [items, setItems] = useState<string[]>(initial);

  const renderItem = ({ item, drag, isActive }: RenderItemParams<string>) => {
    const meta = SECTION_META[item];
    const isHidden = hidden.includes(item);
    return (
      <Pressable
        onLongPress={drag}
        delayLongPress={150}
        style={[
          styles.row,
          shadows.card,
          isActive && { borderColor: palette.imperialGold, transform: [{ scale: 1.02 }] },
          isHidden && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.handle}>≡</Text>
        <Text style={styles.icon}>{meta?.icon ?? '🔹'}</Text>
        <Text style={[text.bodyBold, { flex: 1 }]}>{meta?.label ?? item}</Text>
        <Switch
          value={!isHidden}
          onValueChange={() => toggleHidden(item)}
          trackColor={{ true: palette.imperialGold, false: palette.royalBlueAccent }}
          thumbColor={palette.marbleWhite}
        />
      </Pressable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Screen scroll={false}>
        <Text style={text.imperialHeadline}>Dashboard bearbeiten</Text>
        <Text style={[text.subhead, { textAlign: 'center', marginBottom: spacing.lg }]}>
          Lange drücken und verschieben (≡) · Schalter blendet eine Sektion aus
        </Text>

        <DraggableFlatList
          data={items}
          keyExtractor={(item) => item}
          renderItem={renderItem}
          onDragEnd={({ data }) => {
            setItems(data);
            setOrder(data);
          }}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }}
        />

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={[text.buttonLabel, { color: '#000' }]}>Fertig</Text>
        </Pressable>
      </Screen>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.royalBlue,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginVertical: 4,
  },
  handle: { color: palette.imperialGold, fontSize: 22, fontFamily: 'Lato_900Black' },
  icon: { fontSize: 22 },
  doneBtn: {
    backgroundColor: palette.imperialGold,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
