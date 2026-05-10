import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Tag } from '@/types';
import { palette, radii, spacing } from '@/theme';
import { GoldChip } from './GoldChip';

interface Props {
  value: string[];
  tags: Tag[];
  onChange: (next: string[]) => void;
}

export function TagPicker({ value, tags, onChange }: Props) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tags.length === 0 ? (
        <Text style={{ color: palette.marbleWhiteMuted, fontFamily: 'Lato_400Regular' }}>
          Keine Tags angelegt
        </Text>
      ) : (
        tags.map((t) => {
          const selected = value.includes(t.id);
          return (
            <View
              key={t.id}
              style={[
                styles.tag,
                {
                  backgroundColor: selected ? t.color : 'rgba(212,175,55,0.05)',
                  borderColor: selected ? t.color : palette.cardBorder,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? '#000' : palette.imperialGold,
                  fontFamily: 'Lato_700Bold',
                }}
                onPress={() => toggle(t.id)}
              >
                #{t.label}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

interface DotsProps {
  tagIds?: string[];
  tags: Tag[];
}

export function TagDots({ tagIds, tags }: DotsProps) {
  if (!tagIds?.length) return null;
  return (
    <View style={dotStyles.row}>
      {tagIds.map((id) => {
        const tag = tags.find((t) => t.id === id);
        if (!tag) return null;
        return (
          <View key={id} style={[dotStyles.dot, { backgroundColor: tag.color }]} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
