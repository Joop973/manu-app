import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { uid } from './id';

/**
 * Phase 7 — Sanfte Migration v5 → v6 mit Auto-Backup.
 *
 * Beim ersten Lauf von v6:
 * - Prüft, ob v5 vorhanden ist
 * - Wenn ja: schreibt eine Backup-Datei ins documentDirectory + öffnet
 *   einmalig den Share-Sheet (User kann sie sichern)
 * - Mappt v5 → v6 (Defaults für neue Felder)
 * - Markiert Migration als erledigt
 */

const V5_KEY = 'manu-imperial-store-v5';
const V6_KEY = 'manu-imperial-store-v6';
const MIGRATION_FLAG = 'manu.migration.v5-to-v6.done';

interface V6Patch {
  dashboardOrder: string[];
  dashboardHidden: string[];
  voicePrivacy: 'on-device' | 'cloud';
}

const V6_DEFAULTS: V6Patch = {
  dashboardOrder: [
    'header',
    'clipboard',
    'balance',
    'leftover',
    'monthSlider',
    'heatmap',
    'oracle',
    'goals',
    'quickActions',
    'achievements',
    'properties',
  ],
  dashboardHidden: [],
  voicePrivacy: 'on-device',
};

export async function ensureV5Migration(): Promise<{ migrated: boolean; backupUri?: string }> {
  try {
    const [v5Raw, v6Raw, alreadyDone] = await Promise.all([
      AsyncStorage.getItem(V5_KEY),
      AsyncStorage.getItem(V6_KEY),
      AsyncStorage.getItem(MIGRATION_FLAG),
    ]);

    if (alreadyDone === '1') return { migrated: false };
    if (!v5Raw) {
      await AsyncStorage.setItem(MIGRATION_FLAG, '1');
      return { migrated: false };
    }
    if (v6Raw) {
      // v6 hat bereits Daten — nicht überschreiben, nur Flag setzen
      await AsyncStorage.setItem(MIGRATION_FLAG, '1');
      return { migrated: false };
    }

    // 1) Auto-Backup schreiben
    let backupUri: string | undefined;
    try {
      const backup = {
        version: 1,
        createdAt: new Date().toISOString(),
        app: 'manu-imperial-finance',
        storeKey: V5_KEY,
        reason: 'auto-migration-v5-to-v6',
        data: JSON.parse(v5Raw),
      };
      const path = `${FileSystem.documentDirectory}migration-backup-${uid('mig')}.manubak`;
      await FileSystem.writeAsStringAsync(path, `PLAIN\n${JSON.stringify(backup)}`);
      backupUri = path;
    } catch (e) {
      console.warn('[Migration] Auto-Backup fehlgeschlagen:', e);
    }

    // 2) v5-Daten mit v6-Defaults mergen
    const v5Parsed = JSON.parse(v5Raw);
    const v5State = v5Parsed.state ?? v5Parsed; // zustand persist wraps in {state, version}
    const v6State = {
      ...v5State,
      ...V6_DEFAULTS,
      settings: {
        ...(v5State.settings ?? {}),
        voicePrivacy: 'on-device',
      },
    };
    const v6Wrapper = { state: v6State, version: 0 };
    await AsyncStorage.setItem(V6_KEY, JSON.stringify(v6Wrapper));

    // 3) Flag setzen
    await AsyncStorage.setItem(MIGRATION_FLAG, '1');

    // 4) Share-Sheet einmalig öffnen, damit User Backup sichern kann
    if (backupUri) {
      try {
        if (await Sharing.isAvailableAsync()) {
          // Etwas Verzögerung, damit App schon hydriert ist
          setTimeout(() => {
            Sharing.shareAsync(backupUri!).catch(() => {});
          }, 1500);
        }
      } catch {
        // ignore
      }
    }

    return { migrated: true, backupUri };
  } catch (e) {
    console.error('[Migration] Fehler:', e);
    return { migrated: false };
  }
}
