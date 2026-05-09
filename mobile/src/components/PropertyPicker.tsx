import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing } from '@/theme';
import { Property } from '@/types';
import { GoldChip } from './GoldChip';

interface Props {
  value: string | null;
  properties: Property[];
  onChange: (id: string | null) => void;
  allowNone?: boolean;
}

export function PropertyPicker({ value, properties, onChange, allowNone = true }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {allowNone && (
        <GoldChip label="Privat" selected={value === null} onPress={() => onChange(null)} />
      )}
      {properties.map((p) => {
        const selected = value === p.id;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            style={[
              styles.chip,
              {
                borderColor: selected ? p.color : palette.cardBorder,
                backgroundColor: selected ? p.color : 'rgba(212,175,55,0.05)',
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: selected ? '#000' : p.color }]} />
            <Text
              style={{
                color: selected ? '#000' : palette.imperialGold,
                fontFamily: 'Lato_700Bold',
                paddingLeft: 6,
              }}
            >
              {p.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
