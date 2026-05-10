import { StyleSheet, View } from 'react-native';

import { palette, radii } from '@/theme';

interface Props {
  percent: number;
  height?: number;
  fillColor?: string;
}

export function ProgressBar({ percent, height = 8, fillColor = palette.imperialGold }: Props) {
  const safe = Math.max(0, Math.min(1, percent));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${safe * 100}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: palette.royalBlueAccent, overflow: 'hidden' },
  fill: { },
});
