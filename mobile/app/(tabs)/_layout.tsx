import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { palette } from '@/theme/colors';

export default function TabsLayout() {
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
          title: 'Dashboard',
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
        name="rules"
        options={{
          title: 'Regeln',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text>,
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: 'Vorlagen',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🪙</Text>,
        }}
      />
    </Tabs>
  );
}
