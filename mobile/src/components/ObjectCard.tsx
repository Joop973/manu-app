import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatEuro } from '@/lib/calc';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { Property } from '@/types';

interface Props {
  property: Property;
  income: number;
  expense: number;
  onPress: () => void;
}

export function ObjectCard({ property, income, expense, onPress }: Props) {
  const balance = income - expense;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        { borderLeftColor: property.color },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.header}>
        <Text style={[text.sectionTitle, { fontSize: 16 }]} numberOfLines={1}>
          {property.name}
        </Text>
        <View style={[styles.colorDot, { backgroundColor: property.color }]} />
      </View>
      {property.address ? (
        <Text style={[text.subhead, { marginTop: 2 }]} numberOfLines={1}>
          {property.address}
        </Text>
      ) : null}

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={[text.caption]}>Einnahmen</Text>
          <Text style={[text.amountMedium, { color: palette.successGreen }]}>
            {formatEuro(income)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[text.caption]}>Ausgaben</Text>
          <Text style={[text.amountMedium, { color: palette.dangerRed }]}>
            {formatEuro(expense)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[text.caption]}>Saldo</Text>
          <Text
            style={[
              text.amountMedium,
              { color: balance >= 0 ? palette.successGreen : palette.dangerRed },
            ]}
          >
            {formatEuro(balance)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  metric: { flex: 1 },
});
