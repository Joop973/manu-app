import { StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing, text } from '@/theme';

interface Props {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon = '🏛️', title, description }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[text.sectionTitle, { textAlign: 'center', marginTop: spacing.md }]}>{title}</Text>
      {description ? (
        <Text style={[text.subhead, { textAlign: 'center', marginTop: spacing.sm }]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
  icon: { fontSize: 48 },
});
