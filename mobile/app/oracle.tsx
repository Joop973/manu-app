import { Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { MonthSlider } from '@/components/MonthSlider';
import { OracleCard } from '@/components/OracleCard';
import { Screen } from '@/components/Screen';
import { generateOracleTips } from '@/lib/oracle';
import { useAppStore } from '@/store/useAppStore';
import { spacing, text } from '@/theme';

export default function OracleScreen() {
  const bookings = useAppStore((s) => s.bookings);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);

  const tips = generateOracleTips({ bookings, monthIso: currentMonth });

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Das Orakel</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        Spartipps und Beobachtungen — regelbasiert, lokal berechnet (F-034)
      </Text>

      <MonthSlider value={currentMonth} onChange={setCurrentMonth} />

      {tips.length === 0 ? (
        <EmptyState
          icon="👁"
          title="Noch keine Beobachtungen"
          description="Sobald genug Buchungen vorliegen, spricht das Orakel."
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {tips.map((t) => (
            <OracleCard key={t.id} tip={t} />
          ))}
        </View>
      )}
    </Screen>
  );
}
