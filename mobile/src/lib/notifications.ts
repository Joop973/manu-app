import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ScheduledReminder } from '@/types';

/**
 * F-107 Lokale Benachrichtigungen über expo-notifications.
 * Komplett lokal — kein Push-Server.
 */

let configured = false;

async function configure() {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('manu-imperial', {
      name: 'Manu Imperial Reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  configured = true;
}

export async function ensurePermission(): Promise<boolean> {
  await configure();
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const ask = await Notifications.requestPermissionsAsync();
  return ask.granted;
}

export async function scheduleReminder(input: {
  label: string;
  body?: string;
  fireDate: Date;
}): Promise<string> {
  await configure();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: input.label,
      body: input.body ?? 'Erinnerung von Manu Imperial Finance',
      sound: false,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: input.fireDate } as any,
  });
  return id;
}

export async function cancelReminder(notificationId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // bereits abgelaufen oder ungültig
  }
}

export async function scheduleFromContractDeadline(input: {
  label: string;
  earliestEndDate: string;
  noticeDays: number;
}): Promise<string | null> {
  const fire = new Date(input.earliestEndDate);
  fire.setDate(fire.getDate() - input.noticeDays);
  if (fire.getTime() < Date.now() + 60_000) return null;
  return scheduleReminder({
    label: `📜 Kündigungsfrist: ${input.label}`,
    body: `Heute ist der letzte Tag, um den Vertrag fristgerecht zu kündigen.`,
    fireDate: fire,
  });
}

export async function cancelAll(reminders: ScheduledReminder[]) {
  for (const r of reminders) {
    if (r.notificationId) await cancelReminder(r.notificationId);
  }
}
