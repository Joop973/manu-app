import { Booking, Recurrence } from '@/types';

/**
 * F-023: Wiederkehrende Buchungen.
 * Berechnet das nächste Fälligkeitsdatum (ISO YYYY-MM-DD).
 */
export function nextDueDate(lastDate: string, recurrence: Recurrence): string | null {
  if (recurrence === 'none') return null;
  const [year, month, day] = lastDate.split('-').map(Number);
  const next = new Date(year, month - 1, day);
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  if (recurrence === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * Pattern Recognition (F-018): Schlägt "wiederkehrend" vor, wenn der gleiche
 * Empfänger mit ähnlichem Betrag (±5%) bereits in 2+ verschiedenen Monaten existiert.
 */
export function suggestsRecurrence(
  draft: { amount: number; counterparty?: string },
  history: Booking[],
): boolean {
  if (!draft.counterparty) return false;
  const target = draft.counterparty.trim().toLowerCase();
  if (target.length < 2) return false;

  const matches = history.filter((b) => {
    const c = (b.counterparty ?? '').trim().toLowerCase();
    if (c !== target) return false;
    const ratio = draft.amount === 0 ? 0 : Math.abs(b.amount - draft.amount) / draft.amount;
    return ratio <= 0.05;
  });

  const distinctMonths = new Set(matches.map((b) => b.date.slice(0, 7)));
  return distinctMonths.size >= 2;
}
