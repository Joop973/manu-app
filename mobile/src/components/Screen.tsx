import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export function Screen({ children, scroll = true, contentStyle }: Props) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.bg}>
        <View style={styles.glowTop} pointerEvents="none" />
        <View style={styles.glowBottom} pointerEvents="none" />
        {scroll ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.royalBlueDeep },
  bg: { flex: 1, backgroundColor: palette.royalBlueDeep },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: -50,
    right: -50,
    height: 250,
    borderRadius: 250,
    backgroundColor: 'rgba(212,175,55,0.10)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 300,
    backgroundColor: 'rgba(42,61,111,0.5)',
  },
});
