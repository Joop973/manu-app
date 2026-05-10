import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

interface Step {
  emoji: string;
  title: string;
  body: string;
  cta?: string;
}

const STEPS: Step[] = [
  {
    emoji: '🏛️',
    title: 'Willkommen, Imperator',
    body: 'Manu Imperial Finance ist Dein lokaler Tresor: Buchhaltung, Beleg-Autopilot, Mieter, Reports — alles auf Deinem Gerät, ohne Cloud.',
  },
  {
    emoji: '🏠',
    title: 'Lege Dein erstes Imperium an',
    body: 'Ein Objekt kann ein Haus, eine Wohnung oder einfach „Privat" sein. Gib ihm einen Namen und eine Farbe — alle Buchungen erscheinen damit gruppiert.',
    cta: 'Erstes Objekt anlegen',
  },
  {
    emoji: '🎰',
    title: 'Schnellerfassung',
    body: 'Tippe unten rechts auf den großen goldenen + Button. Beleg-Betrag eingeben, fertig — die KI ergänzt Kategorie und Empfänger automatisch.',
  },
  {
    emoji: '📸',
    title: 'Beleg scannen',
    body: 'PDF oder Foto in den Beleg-Tresor → die App liest Betrag, Datum und Empfänger lokal aus und schlägt die Buchung vor.',
  },
  {
    emoji: '🪙',
    title: 'Dein Tresor ist bereit',
    body: 'Du kannst das Onboarding jederzeit über Einstellungen → Onboarding wiederholen. Viel Erfolg!',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const markOnboardingDone = useAppStore((s) => s.markOnboardingDone);
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Screen scroll={false}>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={styles.emoji}>{current.emoji}</Text>
        <Text style={[text.imperialHeadline, { textAlign: 'center', marginTop: spacing.md }]}>
          {current.title}
        </Text>
        <Text style={[text.subhead, { textAlign: 'center', marginTop: spacing.md }]}>
          {current.body}
        </Text>

        {step === 1 ? <FirstPropertyForm /> : null}
      </View>

      <View style={styles.actions}>
        <CasinoButton
          label="Überspringen"
          variant="ghost"
          style={{ flex: 1 }}
          onPress={() => markOnboardingDone()}
        />
        <CasinoButton
          label={isLast ? 'Tresor öffnen' : 'Weiter'}
          variant="gold"
          style={{ flex: 2 }}
          onPress={() => {
            if (isLast) markOnboardingDone();
            else setStep((s) => s + 1);
          }}
        />
      </View>
    </Screen>
  );
}

function FirstPropertyForm() {
  const properties = useAppStore((s) => s.properties);
  const addProperty = useAppStore((s) => s.addProperty);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  if (properties.length > 0) {
    return (
      <Text style={[text.subhead, { color: palette.successGreen, textAlign: 'center', marginTop: spacing.md }]}>
        ✓ Du hast bereits {properties.length} Objekt(e).
      </Text>
    );
  }

  return (
    <View style={{ marginTop: spacing.lg, gap: spacing.sm, width: '100%' }}>
      <Field label="Name *">
        <TextField value={name} onChangeText={setName} placeholder="z.B. Südstraße 12" />
      </Field>
      <Field label="Adresse">
        <TextField value={address} onChangeText={setAddress} placeholder="Straße, PLZ, Ort" />
      </Field>
      <CasinoButton
        label="+ Anlegen"
        onPress={() => {
          if (!name.trim()) return;
          addProperty({ name: name.trim(), address: address.trim() || undefined });
          setName('');
          setAddress('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.cardBorder,
  },
  dotActive: { backgroundColor: palette.imperialGold, width: 16 },
  card: {
    flex: 1,
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  emoji: { fontSize: 84 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
