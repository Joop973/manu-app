import { Booking, Subscription } from '@/types';

/**
 * F-101 Subscription Detector — erkennt aus Buchungshistorie
 * wiederkehrende kleine Beträge (< 200 € Mt) bei gleichem Empfänger
 * und schlägt sie als Subscriptions vor.
 */

export interface SubscriptionCandidate {
  counterparty: string;
  averageAmount: number;
  occurrences: number;
  monthsSpan: number;
  cadence: 'monthly' | 'yearly' | 'irregular';
  lastDate: string;
  bookingIds: string[];
  categoryId?: string | null;
}

const MIN_OCCURRENCES = 3;
const AMOUNT_TOLERANCE = 0.15; // 15 %

export function detectSubscriptionCandidates(bookings: Booking[]): SubscriptionCandidate[] {
  const grouped = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.type !== 'expense') continue;
    if (!b.counterparty) continue;
    const key = b.counterparty.trim().toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  }

  const candidates: SubscriptionCandidate[] = [];
  for (const [, items] of grouped) {
    if (items.length < MIN_OCCURRENCES) continue;
    const sorted = items.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const avg = sorted.reduce((s, b) => s + b.amount, 0) / sorted.length;
    const inRange = sorted.filter((b) => Math.abs(b.amount - avg) / Math.max(1, avg) <= AMOUNT_TOLERANCE);
    if (inRange.length < MIN_OCCURRENCES) continue;

    const months = new Set(inRange.map((b) => b.date.slice(0, 7)));
    if (months.size < 2) continue;

    const firstDate = inRange[0].date;
    const lastDate = inRange[inRange.length - 1].date;
    const monthsSpan = Math.max(1, monthsBetween(firstDate, lastDate));
    const ratio = inRange.length / monthsSpan;
    const cadence: SubscriptionCandidate['cadence'] =
      ratio >= 0.8 ? 'monthly' : ratio >= 0.06 && ratio <= 0.12 ? 'yearly' : 'irregular';
    if (cadence === 'irregular') continue;

    candidates.push({
      counterparty: inRange[0].counterparty!,
      averageAmount: Math.round(avg * 100) / 100,
      occurrences: inRange.length,
      monthsSpan,
      cadence,
      lastDate,
      bookingIds: inRange.map((b) => b.id),
      categoryId: mostFrequentCategoryId(inRange),
    });
  }
  return candidates.sort((a, b) => b.averageAmount * b.occurrences - a.averageAmount * a.occurrences);
}

function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma) + 1;
}

function mostFrequentCategoryId(bookings: Booking[]): string | null | undefined {
  const tally = new Map<string, number>();
  for (const b of bookings) {
    if (!b.categoryId) continue;
    tally.set(b.categoryId, (tally.get(b.categoryId) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const e of tally.entries()) if (!best || e[1] > best[1]) best = e;
  return best ? best[0] : null;
}

/**
 * Annualisiert die Subscription-Kosten — wichtig für Spar-Hinweise.
 */
export function annualCost(sub: Subscription): number {
  return sub.cadence === 'yearly' ? sub.amount : sub.amount * 12;
}

export function totalAnnualSubscriptionCost(subs: Subscription[]): number {
  return subs.filter((s) => s.active).reduce((sum, s) => sum + annualCost(s), 0);
}
