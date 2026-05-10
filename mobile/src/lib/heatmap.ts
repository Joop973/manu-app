import { Booking } from '@/types';

/**
 * F-104 Calendar Heatmap — Tagesausgaben pro Tag im Monat, GitHub-Style.
 */

export interface HeatmapDay {
  date: string;
  total: number;
  intensity: number; // 0..1
}

export function buildMonthHeatmap(bookings: Booking[], monthIso: string): HeatmapDay[] {
  const tally = new Map<string, number>();
  for (const b of bookings) {
    if (b.type !== 'expense') continue;
    if (!b.date.startsWith(monthIso)) continue;
    tally.set(b.date, (tally.get(b.date) ?? 0) + b.amount);
  }
  const max = Math.max(1, ...tally.values());
  const [y, m] = monthIso.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const out: HeatmapDay[] = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = `${monthIso}-${String(d).padStart(2, '0')}`;
    const total = tally.get(key) ?? 0;
    out.push({ date: key, total, intensity: max > 0 ? total / max : 0 });
  }
  return out;
}
