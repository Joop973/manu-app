import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { palette, radii, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
  threshold?: number;
}

/**
 * F-009 Swipe-Gesten: links wischen → Löschen, rechts wischen → Bearbeiten.
 */
export function SwipeRow({ children, onDelete, onEdit, threshold = 80 }: Props) {
  const translateX = useSharedValue(0);

  const reset = () => {
    translateX.value = withSpring(0);
  };

  const finishLeft = () => {
    onDelete?.();
    reset();
  };

  const finishRight = () => {
    onEdit?.();
    reset();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      const max = 140;
      translateX.value = Math.max(-max, Math.min(max, e.translationX));
    })
    .onEnd(() => {
      if (translateX.value < -threshold && onDelete) {
        translateX.value = withTiming(-1000, { duration: 220 }, () => runOnJS(finishLeft)());
      } else if (translateX.value > threshold && onEdit) {
        translateX.value = withTiming(1000, { duration: 220 }, () => runOnJS(finishRight)());
      } else {
        translateX.value = withSpring(0);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={[styles.action, styles.delete]}>
        <Text style={styles.actionText}>🗑 Löschen</Text>
      </View>
      <View style={[styles.action, styles.edit]}>
        <Text style={styles.actionText}>✏ Bearbeiten</Text>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.body, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', borderRadius: radii.md, overflow: 'hidden' },
  action: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  delete: { right: 0, backgroundColor: palette.dangerRed, alignItems: 'flex-end' },
  edit: { left: 0, backgroundColor: palette.imperialGold, alignItems: 'flex-start' },
  actionText: { color: '#000', fontFamily: 'Lato_900Black', fontSize: 13, letterSpacing: 1 },
  body: { backgroundColor: palette.royalBlueDeep },
});
