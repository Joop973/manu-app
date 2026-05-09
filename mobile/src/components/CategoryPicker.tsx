import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Category } from '@/types';
import { palette, radii, spacing } from '@/theme';
import { GoldChip } from './GoldChip';

interface Props {
  value: string | null;
  categories: Category[];
  onChange: (id: string | null) => void;
}

/**
 * F-017: Emoji-Kategorien — visuell sofort erkennbar.
 */
export function CategoryPicker({ value, categories, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <GoldChip label="—" selected={value === null} onPress={() => onChange(null)} />
      {categories.map((c) => {
        const selected = value === c.id;
        return (
          <View key={c.id} style={styles.cat}>
            <Text style={{ fontSize: 22, marginBottom: 4 }}>{c.emoji}</Text>
            <GoldChip label={c.label} compact selected={selected} onPress={() => onChange(c.id)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

interface CategoryDotProps {
  category?: Category | null;
}

export function CategoryDot({ category }: CategoryDotProps) {
  if (!category) return null;
  return (
    <View style={dotStyles.wrap}>
      <Text style={{ fontSize: 16 }}>{category.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  cat: { alignItems: 'center', maxWidth: 90 },
});

const dotStyles = StyleSheet.create({
  wrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.royalBlueAccent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
});
