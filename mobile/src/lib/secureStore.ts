import * as SecureStore from 'expo-secure-store';

/**
 * Phase 5 — Verschlüsselung at-rest für sensible Felder.
 * iOS: Keychain · Android: EncryptedSharedPreferences.
 *
 * Für PIN-Hash, Backup-Passwörter, OCR-API-Keys — alles was
 * nicht im normalen AsyncStorage liegen soll.
 */

const PIN_KEY = 'manu.pin';
const BACKUP_KEY = 'manu.backup-pwd-hint';

export async function setPinHash(hash: string | null): Promise<void> {
  if (!hash) return SecureStore.deleteItemAsync(PIN_KEY);
  return SecureStore.setItemAsync(PIN_KEY, hash, {
    requireAuthentication: false,
  });
}

export async function getPinHash(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(PIN_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function setBackupPasswordHint(hint: string | null): Promise<void> {
  if (!hint) return SecureStore.deleteItemAsync(BACKUP_KEY);
  return SecureStore.setItemAsync(BACKUP_KEY, hint);
}

export async function getBackupPasswordHint(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(BACKUP_KEY)) ?? null;
  } catch {
    return null;
  }
}
