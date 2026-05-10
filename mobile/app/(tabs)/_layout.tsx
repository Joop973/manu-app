import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Text } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { palette } from '@/theme/colors';

export default function TabsLayout() {
  const lastTab = useAppStore((s) => s.lastTab);
  const setLastTab = useAppStore((s) => s.setLastTab);
  const router = useRouter();
  const segments = useSegments() as string[];
  const restored = useRef(false);

  // F-013 Beim ersten Render zum letzten Tab springen
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (lastTab && lastTab !== 'index') {
      setTimeout(() => {
        try {
          router.replace(`/${lastTab}`);
        } catch {
          // ignore — Routen-Mismatch
        }
      }, 0);
    }
  }, [lastTab, router]);

  // Persistiere bei Tab-Wechsel
  useEffect(() => {
    const last = segments[segments.length - 1];
    if (!last) return;
    const known = ['index', 'bookings', 'tresore', 'admin', 'settings'];
    if (known.includes(last) && last !== lastTab) {
      setLastTab(last);
    }
  }, [segments, lastTab, setLastTab]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.royalBlueDeep },
        headerTitleStyle: {
          color: palette.imperialGold,
          fontFamily: 'Cinzel_700Bold',
          letterSpacing: 1.5,
        },
        tabBarStyle: {
          backgroundColor: palette.royalBlueDeep,
          borderTopColor: palette.cardBorder,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'Lato_700Bold',
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
        tabBarActiveTintColor: palette.imperialGold,
        tabBarInactiveTintColor: palette.marbleWhiteMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hauptsaal',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏛️</Text>,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Buchungen',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🎰</Text>,
        }}
      />
      <Tabs.Screen
        name="tresore"
        options={{
          title: 'Tresore',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🪙</Text>,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Verwaltung',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
