import { Cinzel_700Bold, Cinzel_900Black } from '@expo-google-fonts/cinzel';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond';
import { Lato_400Regular, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './login';
import { parseClipboard } from '@/lib/clipboard';
import { useAppStore } from '@/store/useAppStore';
import { palette } from '@/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cinzel_700Bold,
    Cinzel_900Black,
    CormorantGaramond_500Medium_Italic,
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });

  const hydrated = useAppStore((s) => s.hydrated);
  const unlocked = useAppStore((s) => s.unlocked);
  const settings = useAppStore((s) => s.settings);
  const runAutoBookings = useAppStore((s) => s.runAutoBookings);
  const setClipboardHint = useAppStore((s) => s.setClipboardHint);

  useEffect(() => {
    if (fontsLoaded && hydrated) {
      SplashScreen.hideAsync().catch(() => {});
      const created = runAutoBookings();
      if (created > 0) {
        // eslint-disable-next-line no-console
        console.log(`[Manu] ${created} wiederkehrende Buchung(en) automatisch verbucht.`);
      }
      Clipboard.getStringAsync()
        .then((raw) => setClipboardHint(parseClipboard(raw)))
        .catch(() => {});
    }
  }, [fontsLoaded, hydrated, runAutoBookings, setClipboardHint]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.royalBlueDeep }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {settings.pinHash && !unlocked ? (
          <LoginScreen />
        ) : (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: palette.royalBlueDeep },
              headerTitleStyle: {
                color: palette.imperialGold,
                fontFamily: 'Cinzel_700Bold',
                letterSpacing: 1.5,
              },
              headerTintColor: palette.imperialGold,
              contentStyle: { backgroundColor: palette.royalBlueDeep },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="booking/new" options={{ presentation: 'modal', title: 'Neue Buchung' }} />
            <Stack.Screen name="booking/quick" options={{ presentation: 'modal', title: 'Schnellerfassung' }} />
            <Stack.Screen name="object/new" options={{ presentation: 'modal', title: 'Neues Objekt' }} />
            <Stack.Screen name="object/[id]" options={{ title: 'Objekt' }} />
            <Stack.Screen name="template/new" options={{ presentation: 'modal', title: 'Vorlage' }} />
            <Stack.Screen name="rule/new" options={{ presentation: 'modal', title: 'Regel' }} />
            <Stack.Screen name="tenant/new" options={{ presentation: 'modal', title: 'Mieter' }} />
            <Stack.Screen name="tenant/[id]" options={{ title: 'Mieter' }} />
            <Stack.Screen name="craftsman/new" options={{ presentation: 'modal', title: 'Handwerker' }} />
            <Stack.Screen name="craftsman/[id]" options={{ title: 'Handwerker' }} />
            <Stack.Screen name="receipt/scan" options={{ presentation: 'modal', title: 'Beleg-Scan' }} />
            <Stack.Screen name="receipt/qr" options={{ presentation: 'modal', title: 'QR-Scanner' }} />
            <Stack.Screen name="receipt/[id]" options={{ title: 'Beleg' }} />
            <Stack.Screen name="document/new" options={{ presentation: 'modal', title: 'Dokument' }} />
            <Stack.Screen name="reading/new" options={{ presentation: 'modal', title: 'Zählerstand' }} />
            <Stack.Screen name="oracle" options={{ title: 'Das Orakel' }} />
            <Stack.Screen name="search" options={{ title: 'Suche' }} />
            <Stack.Screen name="year" options={{ title: 'Jahres-Checkup' }} />
            <Stack.Screen name="tag/new" options={{ presentation: 'modal', title: 'Tag' }} />
            <Stack.Screen name="subscriptions" options={{ title: 'Abos' }} />
            <Stack.Screen name="contracts" options={{ title: 'Verträge' }} />
            <Stack.Screen name="goals" options={{ title: 'Sparziele' }} />
            <Stack.Screen name="networth" options={{ title: 'Net Worth' }} />
            <Stack.Screen name="budgets" options={{ title: 'Budgets' }} />
            <Stack.Screen name="investments" options={{ title: 'Investments' }} />
            <Stack.Screen name="debt" options={{ title: 'Tilgungsplaner' }} />
            <Stack.Screen name="splits" options={{ title: 'Splits' }} />
            <Stack.Screen name="whatif" options={{ title: 'Was-wäre-wenn' }} />
            <Stack.Screen name="brutto-netto" options={{ title: 'Brutto / Netto' }} />
            <Stack.Screen name="csv-import" options={{ presentation: 'modal', title: 'CSV-Import' }} />
            <Stack.Screen name="reports" options={{ title: 'Reports' }} />
            <Stack.Screen name="maintenance/new" options={{ presentation: 'modal', title: 'Wartung' }} />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
