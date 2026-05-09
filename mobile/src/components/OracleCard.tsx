import { StyleSheet, Text, View } from 'react-native';

import { OracleTip } from '@/lib/oracle';
import { palette, radii, spacing, text } from '@/theme';

interface Props {
  tip: OracleTip;
}

export function OracleCard({ tip }: Props) {
  const tint =
    tip.kind === 'praise'
      ? palette.successGreen
      : tip.kind === 'warning'
        ? palette.dangerRed
        : palette.imperialGold;
  return (
    <View style={[styles.card, { borderColor: tint }]}>
      <Text style={[text.sectionTitle, { color: tint, fontSize: 14 }]}>👁 {tip.title}</Text>
      <Text style={[text.subhead, { marginTop: 6 }]}>{tip.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
});
