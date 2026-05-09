import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Screen } from '@/components/Screen';
import { success as hapticSuccess } from '@/lib/feedback';
import { parseEpcQr } from '@/lib/parseReceipt';
import { palette, radii, spacing, text } from '@/theme';

/**
 * F-031: QR-Code Scanner für deutsche EPC-Girocodes auf Rechnungen.
 */
export default function QrScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return <Screen><Text style={text.body}>Kamera-Status wird geprüft …</Text></Screen>;

  if (!permission.granted) {
    return (
      <Screen>
        <Text style={[text.subhead, { textAlign: 'center' }]}>
          Für den QR-Scanner wird Zugriff auf die Kamera benötigt.
        </Text>
        <CasinoButton label="Kamera erlauben" onPress={requestPermission} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            scanned
              ? undefined
              : ({ data }) => {
                  setScanned(true);
                  const epc = parseEpcQr(data);
                  if (!epc) {
                    setScanned(false);
                    return;
                  }
                  hapticSuccess();
                  router.replace({
                    pathname: '/booking/new',
                    params: {
                      prefillAmount: epc.amount?.toString() ?? '',
                      prefillCounterparty: epc.counterparty ?? epc.iban ?? '',
                    },
                  });
                }
          }
        />
        <View style={styles.frame} pointerEvents="none" />
      </View>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Halte den QR-Code in den goldenen Rahmen.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  frame: {
    alignSelf: 'center',
    marginTop: '30%',
    width: 240,
    height: 240,
    borderColor: palette.imperialGold,
    borderWidth: 3,
    borderRadius: radii.lg,
    backgroundColor: 'transparent',
  },
});
