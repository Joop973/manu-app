import { Booking } from '@/types';

/**
 * F-034: KI-Orakel — regelbasierte Spartipps.
 */

export interface OracleTip {
  id: string;
  kind: 'warning' | 'praise' | 'info';
  title: string;
  body: string;
}

const SPENDY_KEYWORDS = ['pokemon', 'pokémon', 'casino', 'lotto', 'tabak', 'gaming', 'cardmarket'];

interface OracleInput {
  bookings: Booking[];
  monthIso: string;
}

function inMonth(b: Booking, monthIso: string): boolean {
  return b.date.startsWith(monthIso);
}

export function generateOracleTips(input: OracleInput): OracleTip[] {
  const { bookings, monthIso } = input;
  const tips: OracleTip[] = [];
  const monthBookings = bookings.filter((b) => inMonth(b, monthIso));

  // Kleinausgaben-Warnung
  const counterpartyTally = new Map<string, { count: number; sum: number }>();
  for (const b of monthBookings) {
    if (b.type !== 'expense' || !b.counterparty) continue;
    const key = b.counterparty.trim().toLowerCase();
    const entry = counterpartyTally.get(key) ?? { count: 0, sum: 0 };
    entry.count += 1;
    entry.sum += b.amount;
    counterpartyTally.set(key, entry);
  }
  for (const [key, { count, sum }] of counterpartyTally.entries()) {
    if (count >= 6 && sum / count < 30) {
      tips.push({
        id: `small-${key}`,
        kind: 'warning',
        title: 'Kleinausgaben summieren sich',
        body: `${count}× ${key} im Monat (Ø ${(sum / count).toFixed(2)} €). Bewusste Pause überlegenswert.`,
      });
    }
  }

  // Impulskauf-Warnung
  for (const b of monthBookings) {
    if (b.type !== 'expense' || b.amount < 200) continue;
    const haystack = `${b.counterparty ?? ''} ${b.note ?? ''}`.toLowerCase();
    if (SPENDY_KEYWORDS.some((kw) => haystack.includes(kw))) {
      tips.push({
        id: `impulse-${b.id}`,
        kind: 'warning',
        title: 'Impulskauf erkannt',
        body: `${b.amount.toFixed(2)} € bei ${b.counterparty ?? 'unbekannt'}. 30-Tage-Wartezeit verhindert Reue.`,
      });
    }
  }

  // Negativ-Bilanz
  const income = monthBookings.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0);
  const expense = monthBookings.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
  if (income > 0 && expense > income) {
    tips.push({
      id: `neg-${monthIso}`,
      kind: 'warning',
      title: 'Ausgaben über Einnahmen',
      body: `In diesem Monat ${(expense - income).toFixed(2)} € im Minus. Fixkosten oder ungeplante Reparaturen prüfen.`,
    });
  } else if (income > 0 && (income - expense) / income > 0.4) {
    tips.push({
      id: `royal-${monthIso}`,
      kind: 'praise',
      title: 'Royale Marge',
      body: `Profitmarge ${(((income - expense) / income) * 100).toFixed(0)} %. Ein würdiger Monat für den Tresor.`,
    });
  }

  return tips.slice(0, 2);
}
