import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function CraftsmanDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const craftsman = useAppStore((s) => s.craftsmen.find((c) => c.id === id));
  const removeCraftsman = useAppStore((s) => s.removeCraftsman);

  if (!craftsman) {
    return <Screen><EmptyState icon="❓" title="Handwerker nicht gefunden" /></Screen>;
  }

  return (
    <Screen>
      <View style={[styles.card, shadows.card]}>
        <Text style={text.imperialHeadline}>{craftsman.name}</Text>
        <Text style={[text.subhead, { textAlign: 'center' }]}>{craftsman.trade}</Text>
      </View>

      {craftsman.phone ? (
        <CasinoButton
          label={`📞 Anrufen (${craftsman.phone})`}
          variant="green"
          onPress={() => Linking.openURL(`tel:${craftsman.phone}`)}
        />
      ) : null}
      {craftsman.email ? (
        <CasinoButton
          label="✉️ E-Mail"
          variant="ghost"
          onPress={() => Linking.openURL(`mailto:${craftsman.email}`)}
        />
      ) : null}
      {craftsman.website ? (
        <CasinoButton
          label="🌐 Website öffnen"
          variant="ghost"
          onPress={() => {
            const url = craftsman.website!.startsWith('http')
              ? craftsman.website!
              : `https://${craftsman.website}`;
            Linking.openURL(url);
          }}
        />
      ) : null}

      {craftsman.hours ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Öffnungszeiten</Text>
          <Text style={text.body}>{craftsman.hours}</Text>
        </View>
      ) : null}
      {craftsman.notes ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={text.sectionTitle}>Notizen</Text>
          <Text style={text.body}>{craftsman.notes}</Text>
        </View>
      ) : null}

      <CasinoButton
        label="🗑 Löschen"
        variant="red"
        onPress={() =>
          Alert.alert('Handwerker löschen?', craftsman.name, [
            { text: 'Abbrechen', style: 'cancel' },
            {
              text: 'Löschen',
              style: 'destructive',
              onPress: () => {
                removeCraftsman(craftsman.id);
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.lg,
    gap: 6,
  },
});
