import { AppState, AppStateStatus } from 'react-native';

import { useAppStore } from '@/store/useAppStore';

/**
 * F-130 Auto-Lock — sperrt die App nach X Minuten Inaktivität,
 * sowie sofort beim Wechsel in den Hintergrund (wenn ein PIN gesetzt ist).
 */

let lastActiveAt: number = Date.now();
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;

export function bumpActivity() {
  lastActiveAt = Date.now();
}

export function startAutoLock() {
  stopAutoLock();
  appStateSub = AppState.addEventListener('change', handleAppState);
  intervalHandle = setInterval(checkLock, 30_000);
}

export function stopAutoLock() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  if (appStateSub) appStateSub.remove();
  appStateSub = null;
}

function handleAppState(state: AppStateStatus) {
  if (state === 'active') {
    bumpActivity();
    return;
  }
  // Beim Wechsel in den Hintergrund sofort sperren, wenn PIN gesetzt
  const store = useAppStore.getState();
  if (store.settings.pinHash && store.unlocked) {
    store.setUnlocked(false);
  }
}

function checkLock() {
  const store = useAppStore.getState();
  if (!store.settings.pinHash) return;
  if (!store.unlocked) return;
  const minutes = store.settings.autoLockMinutes;
  if (minutes <= 0) return;
  if (Date.now() - lastActiveAt > minutes * 60_000) {
    store.setUnlocked(false);
  }
}
