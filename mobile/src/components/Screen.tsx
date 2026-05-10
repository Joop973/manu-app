import { ReactNode, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';
import { palette, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** F-013: Wenn gesetzt, wird die Scroll-Position pro Key persistiert. */
  scrollKey?: string;
}

export function Screen({ children, scroll = true, contentStyle, scrollKey }: Props) {
  const ref = useRef<ScrollView>(null);
  const stored = useAppStore((s) => (scrollKey ? s.scrollPositions[scrollKey] ?? 0 : 0));
  const setScrollPosition = useAppStore((s) => s.setScrollPosition);

  // Initial Scroll-Position wiederherstellen
  useEffect(() => {
    if (!scrollKey || !scroll) return;
    if (stored > 0) {
      const t = setTimeout(() => ref.current?.scrollTo({ y: stored, animated: false }), 50);
      return () => clearTimeout(t);
    }
  }, [scroll, scrollKey, stored]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.bg}>
        <View style={styles.glowTop} pointerEvents="none" />
        <View style={styles.glowBottom} pointerEvents="none" />
        {scroll ? (
          <ScrollView
            ref={ref}
            style={styles.scroll}
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={500}
            onScroll={
              scrollKey
                ? (e) => setScrollPosition(scrollKey, e.nativeEvent.contentOffset.y)
                : undefined
            }
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
