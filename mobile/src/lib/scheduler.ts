import { useAppStore } from '@/store/useAppStore';
import { ensurePermission, scheduleReminder } from './notifications';

/**
 * F-039: Plant am 1. eines jeden Monats eine lokale Notification.
 * Idempotent — wenn schon ein Reminder mit kind="monthlyReport" + Datum 1. Nächsten Monats existiert, no-op.
 */
export async function scheduleMonthlyReportReminder(): Promise<void> {
  const ok = await ensurePermission();
  if (!ok) return;
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0);
  const fireIso = next.toISOString();

  const store = useAppStore.getState();
  const exists = store.reminders.find(
    (r) => r.kind === 'monthlyReport' && r.date.startsWith(fireIso.slice(0, 10)),
  );
  if (exists) return;

  const id = await scheduleReminder({
    label: '📄 Monatsreport ist bereit',
    body: 'Tippe, um den PDF-Report für den letzten Monat zu öffnen.',
    fireDate: next,
  });
  store.addReminder({
    label: 'Monatsreport',
    date: fireIso,
    kind: 'monthlyReport',
    notificationId: id,
  });
}
