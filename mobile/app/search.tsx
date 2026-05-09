import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { searchAll, SearchHit } from '@/lib/search';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

const ROUTE_FOR_KIND: Record<SearchHit['kind'], (id: string) => any> = {
  booking: () => '/bookings',
  property: (id) => ({ pathname: '/object/[id]', params: { id } }),
  tenant: (id) => ({ pathname: '/tenant/[id]', params: { id } }),
  craftsman: (id) => ({ pathname: '/craftsman/[id]', params: { id } }),
  receipt: (id) => ({ pathname: '/receipt/[id]', params: { id } }),
  document: () => '/tresore',
};

const ICON_FOR_KIND: Record<SearchHit['kind'], string> = {
  booking: '🎰',
  property: '🏛️',
  tenant: '👤',
  craftsman: '🔧',
  receipt: '📄',
  document: '📑',
};

export default function SearchScreen() {
  const router = useRouter();
  const data = useAppStore((s) => ({
    bookings: s.bookings,
    properties: s.properties,
    tenants: s.tenants,
    craftsmen: s.craftsmen,
    documents: s.documents,
    receipts: s.receipts,
    categories: s.categories,
  }));

  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchAll(query, data), [query, data]);

  return (
    <Screen>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Buchungen, Mieter, Handwerker, Belege, Dokumente — alles auf einmal (F-008)
      </Text>

      <Field label="Suche">
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Mindestens 2 Zeichen …"
          autoCapitalize="none"
          autoFocus
        />
      </Field>

      {query.length >= 2 && hits.length === 0 ? (
        <EmptyState icon="🔍" title="Keine Treffer" />
      ) : null}

      {hits.map((h) => (
        <Pressable
          key={`${h.kind}-${h.id}`}
          onPress={() => {
            const target = ROUTE_FOR_KIND[h.kind](h.id);
            router.push(target);
          }}
          style={[styles.hit, shadows.card]}
        >
          <Text style={styles.icon}>{ICON_FOR_KIND[h.kind]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={text.bodyBold} numberOfLines={1}>
              {h.title}
            </Text>
            {h.subtitle ? (
              <Text style={text.caption} numberOfLines={1}>
                {h.subtitle}
              </Text>
            ) : null}
          </View>
          {h.trailing ? <Text style={[text.bodyBold, { color: palette.imperialGold }]}>{h.trailing}</Text> : null}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.royalBlue,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  icon: { fontSize: 24 },
});
