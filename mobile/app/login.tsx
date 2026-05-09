import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { CasinoButton } from '@/components/CasinoButton';
import { Field, TextField } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { error as hapticError, success as hapticSuccess } from '@/lib/feedback';
import { useAppStore } from '@/store/useAppStore';
import { palette, radii, shadows, spacing, text } from '@/theme';

export default function LoginScreen() {
  const settings = useAppStore((s) => s.settings);
  const verifyAppPin = useAppStore((s) => s.verifyAppPin);
  const setUnlocked = useAppStore((s) => s.setUnlocked);
  const setPin = useAppStore((s) => s.setPin);
  const setBiometric = useAppStore((s) => s.setBiometric);

  const [pin, setPinInput] = useState('');
  const [pin2, setPin2] = useState('');
  const [mode, setMode] = useState<'unlock' | 'create'>(settings.pinHash ? 'unlock' : 'create');

  useEffect(() => {
    if (mode !== 'unlock') return;
    if (!settings.biometricEnabled) return;
    (async () => {
      const supported = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!supported || !enrolled) return;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Tresor öffnen',
        fallbackLabel: 'PIN eingeben',
        cancelLabel: 'Abbrechen',
      });
      if (result.success) {
        hapticSuccess();
        setUnlocked(true);
      }
    })().catch(() => {});
  }, [mode, settings.biometricEnabled, setUnlocked]);

  const handleUnlock = () => {
    if (verifyAppPin(pin)) {
      hapticSuccess();
      setUnlocked(true);
    } else {
      hapticError();
      Alert.alert('Falscher PIN', 'Bitte erneut versuchen.');
    }
    setPinInput('');
  };

  const handleCreate = async () => {
    if (pin.length < 4) {
      Alert.alert('PIN zu kurz', 'Mindestens 4 Stellen.');
      return;
    }
    if (pin !== pin2) {
      Alert.alert('Stimmt nicht überein', 'Bitte beide Felder gleich.');
      return;
    }
    setPin(pin);
    const supported = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (supported && enrolled) {
      Alert.alert('Biometrie aktivieren?', 'Face ID / Touch ID statt PIN beim Öffnen?', [
        { text: 'Später', style: 'cancel', onPress: () => setUnlocked(true) },
        {
          text: 'Aktivieren',
          onPress: () => {
            setBiometric(true);
            setUnlocked(true);
          },
        },
      ]);
    } else {
      setUnlocked(true);
    }
  };

  return (
    <Screen>
      <View style={[styles.vault, shadows.goldChip]}>
        <Text style={styles.vaultIcon}>🏛️</Text>
      </View>
      <Text style={[text.imperialHeadline, { textAlign: 'center' }]}>Marcus Aurelius</Text>
      <Text style={[text.subhead, { textAlign: 'center' }]}>
        {mode === 'unlock' ? 'Tresor öffnen' : 'Tresor anlegen'}
      </Text>

      <Field label="PIN (mind. 4 Stellen)">
        <TextField
          value={pin}
          onChangeText={setPinInput}
          keyboardType="number-pad"
          secureTextEntry
          autoFocus
          maxLength={12}
        />
      </Field>

      {mode === 'create' ? (
        <Field label="PIN bestätigen">
          <TextField
            value={pin2}
            onChangeText={setPin2}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={12}
          />
        </Field>
      ) : null}

      <View style={{ height: spacing.md }} />

      <CasinoButton
        label={mode === 'unlock' ? 'Betrete den Palast' : 'Tresor erstellen'}
        onPress={mode === 'unlock' ? handleUnlock : handleCreate}
      />

      {mode === 'unlock' && settings.biometricEnabled ? (
        <Text style={[text.caption, { textAlign: 'center', marginTop: 8 }]}>
          Biometrie verfügbar — Tippen zum Auslösen
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  vault: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    borderRadius: 50,
    borderWidth: 4,
    borderColor: palette.imperialGoldLight,
    backgroundColor: palette.imperialGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultIcon: { fontSize: 48 },
});
