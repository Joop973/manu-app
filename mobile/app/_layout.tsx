import { Cinzel_700Bold, Cinzel_900Black } from '@expo-google-fonts/cinzel';
import {
  CormorantGaramond_500Medium_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
} from '@expo-google-fonts/lato';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
  const runAutoBookings = useAppStore((s) => s.runAutoBookings);

  useEffect(() => {
    if (fontsLoaded && hydrated) {
      SplashScreen.hideAsync().catch(() => {});
      // F-023: Auto-Buchungen ausführen
      const created = runAutoBookings();
      if (created > 0) {
        // eslint-disable-next-line no-console
        console.log(`[Manu] ${created} wiederkehrende Buchung(en) automatisch verbucht.`);
      }
      // F-025: Clipboard-Hint speichern (Banner zeigt Dashboard)
      Clipboard.getStringAsync()
        .then((raw) => {
          const hint = parseClipboard(raw);
          useAppStore.getState().setClipboardHint(hint);
        })
        .catch(() => {});
    }
  }, [fontsLoaded, hydrated, runAutoBookings]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.royalBlueDeep }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
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
          <Stack.Screen
            name="booking/new"
            options={{ presentation: 'modal', title: 'Neue Buchung' }}
          />
          <Stack.Screen
            name="booking/quick"
            options={{ presentation: 'modal', title: 'Schnellerfassung' }}
          />
          <Stack.Screen
            name="object/new"
            options={{ presentation: 'modal', title: 'Neues Objekt' }}
          />
          <Stack.Screen name="object/[id]" options={{ title: 'Objekt' }} />
          <Stack.Screen
            name="template/new"
            options={{ presentation: 'modal', title: 'Vorlage' }}
          />
          <Stack.Screen
            name="rule/new"
            options={{ presentation: 'modal', title: 'Regel' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
