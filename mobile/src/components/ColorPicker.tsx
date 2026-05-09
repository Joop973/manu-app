import { Pressable, StyleSheet, View } from 'react-native';

import { objectColors } from '@/theme/colors';

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {objectColors.map((color) => {
        const selected = value === color;
        return (
          <Pressable
            key={color}
            onPress={() => onChange(color)}
            style={[
              styles.swatch,
              {
                backgroundColor: color,
                borderColor: selected ? '#fff' : 'rgba(255,255,255,0.15)',
                borderWidth: selected ? 3 : 1,
                transform: selected ? [{ scale: 1.1 }] : [{ scale: 1 }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18 },
});
