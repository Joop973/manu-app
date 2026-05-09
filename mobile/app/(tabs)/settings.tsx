import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { GoldChip } from '@/components/GoldChip';
import { Screen } from '@/components/Screen';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';
import { FontScale } from '@/types';

const SCALES: { value: FontScale; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Groß' },
  { value: 'xlarge', label: 'Sehr Groß' },
];

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const setPin = useAppStore((s) => s.setPin);
  const setBiometric = useAppStore((s) => s.setBiometric);
  const setFontScale = useAppStore((s) => s.setFontScale);
  const setHaptic = useAppStore((s) => s.setHaptic);
  const setSound = useAppStore((s) => s.setSound);
  const setUnlocked = useAppStore((s) => s.setUnlocked);

  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');

  const updatePin = () => {
    if (newPin.length < 4) return Alert.alert('PIN zu kurz');
    if (newPin !== newPin2) return Alert.alert('Stimmt nicht überein');
    setPin(newPin);
    setNewPin('');
    setNewPin2('');
    Alert.alert('PIN gespeichert');
  };

  const removePin = () =>
    Alert.alert('PIN entfernen?', 'Die App wird ohne Schutz gestartet.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: () => {
          setPin(null);
          Alert.alert('PIN entfernt');
        },
      },
    ]);

  const toggleBiometric = async (next: boolean) => {
    if (!next) return setBiometric(false);
    const supported = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!supported || !enrolled) {
      return Alert.alert('Nicht verfügbar', 'Biometrie ist auf diesem Gerät nicht eingerichtet.');
    }
    if (!settings.pinHash) {
      return Alert.alert('PIN fehlt', 'Bitte zuerst einen PIN setzen.');
    }
    setBiometric(true);
  };

  return (
    <Screen>
      <Text style={text.imperialHeadline}>Einstellungen</Text>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>🔒 Sicherheit</Text>
        {settings.pinHash ? (
          <Text style={text.subhead}>PIN ist gesetzt.</Text>
        ) : (
          <Text style={text.subhead}>Kein PIN — App startet ungeschützt.</Text>
        )}

        <Field label="PIN setzen / ändern">
          <TextField
            value={newPin}
            onChangeText={setNewPin}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="mind. 4 Stellen"
          />
          <TextField
            value={newPin2}
            onChangeText={setNewPin2}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="bestätigen"
            style={{ marginTop: spacing.sm }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <CasinoButton label="PIN speichern" onPress={updatePin} style={{ flex: 1 }} />
            {settings.pinHash ? (
              <CasinoButton label="PIN entfernen" variant="ghost" onPress={removePin} style={{ flex: 1 }} />
            ) : null}
          </View>
        </Field>

        <View style={styles.toggle}>
          <Text style={text.body}>👆 Biometrie (Face ID / Touch ID)</Text>
          <Switch
            value={settings.biometricEnabled}
            onValueChange={toggleBiometric}
            trackColor={{ true: palette.imperialGold, false: palette.royalBlueAccent }}
            thumbColor={palette.marbleWhite}
          />
        </View>

        {settings.pinHash ? (
          <CasinoButton
            label="🔒 Tresor sperren"
            variant="ghost"
            onPress={() => setUnlocked(false)}
          />
        ) : null}
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>🔡 Schriftgröße</Text>
        <View style={styles.row}>
          {SCALES.map((s) => (
            <GoldChip
              key={s.value}
              label={s.label}
              selected={settings.fontScale === s.value}
              onPress={() => setFontScale(s.value)}
            />
          ))}
        </View>
        <Text style={text.subhead}>
          Hinweis: Schriftgröße wird in der nächsten Phase global angewendet.
        </Text>
      </View>

      <View style={[styles.card, shadows.card]}>
        <Text style={text.sectionTitle}>🎰 Casino-Feeling</Text>
        <View style={styles.toggle}>
          <Text style={text.body}>📳 Haptisches Feedback</Text>
          <Switch
            value={settings.hapticEnabled}
            onValueChange={setHaptic}
            trackColor={{ true: palette.imperialGold, false: palette.royalBlueAccent }}
            thumbColor={palette.marbleWhite}
          />
        </View>
        <View style={styles.toggle}>
          <Text style={text.body}>🔔 Sound bei Aktionen</Text>
          <Switch
            value={settings.soundEnabled}
            onValueChange={setSound}
            trackColor={{ true: palette.imperialGold, false: palette.royalBlueAccent }}
            thumbColor={palette.marbleWhite}
          />
        </View>
      </View>
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
    gap: spacing.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
