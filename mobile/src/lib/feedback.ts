import * as Haptics from 'expo-haptics';

import { useAppStore } from '@/store/useAppStore';

/**
 * F-051: Casino-Sound + Haptik. Sound-Effekte werden ohne Asset-Dateien
 * nur per Haptik dargestellt (sichere Default ohne Bundling-Aufwand).
 */
export function selection() {
  if (!useAppStore.getState().settings.hapticEnabled) return;
  Haptics.selectionAsync().catch(() => {});
}

export function success() {
  if (!useAppStore.getState().settings.hapticEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warning() {
  if (!useAppStore.getState().settings.hapticEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

export function error() {
  if (!useAppStore.getState().settings.hapticEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
