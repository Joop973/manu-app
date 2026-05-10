import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { ReactNode, useCallback, useImperativeHandle, useRef, forwardRef } from 'react';
import { StyleSheet } from 'react-native';

import { palette, radii, spacing } from '@/theme';

export interface SheetRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  children: ReactNode;
  snapPoints?: (string | number)[];
}

/**
 * F-007: Echtes Bottom-Sheet via @gorhom/bottom-sheet.
 */
export const Sheet = forwardRef<SheetRef, Props>(({ children, snapPoints = ['50%', '85%'] }, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.indicator}
      enablePanDownToClose
    >
      <BottomSheetView style={styles.body}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
});

Sheet.displayName = 'Sheet';

const styles = StyleSheet.create({
  background: {
    backgroundColor: palette.royalBlue,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderColor: palette.cardBorder,
  },
  indicator: { backgroundColor: palette.imperialGold, width: 50 },
  body: { padding: spacing.lg, gap: spacing.md, flex: 1 },
});
