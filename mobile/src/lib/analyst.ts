import { Booking, Category, Property } from '@/types';
import { addMonths } from './dates';
import { formatEuro } from './calc';

/**
 * F-123 AI-Analyst regelbasiert — beantwortet Fragen wie
 * "Warum sind die Nebenkosten 30% höher?" durch Vergleich mit Vormonat.
 */

export interface AnalystInsight {
  id: string;
  headline: string;
  detail: string;
  trend: 'up' | 'down' | 'flat';
  delta: number;
}

export function analyzeMonthDelta(input: {
  bookings: Booking[];
  categories: Category[];
  properties: Property[];
  monthIso: string;
}): AnalystInsight[] {
  const { bookings, categories, properties, monthIso } = input;
  const prevMonth = addMonths(monthIso, -1);
  const insights: AnalystInsight[] = [];

  // Pro Kategorie Vergleich
  const sumByCategory = (target: string) => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.type !== 'expense') continue;
      if (!b.date.startsWith(target)) continue;
      const k = b.categoryId ?? 'none';
      map.set(k, (map.get(k) ?? 0) + b.amount);
    }
    return map;
  };

  const cur = sumByCategory(monthIso);
  const prev = sumByCategory(prevMonth);
  for (const [catId, currentSum] of cur.entries()) {
    const previousSum = prev.get(catId) ?? 0;
    if (currentSum < 50) continue;
    const delta = previousSum === 0 ? 1 : (currentSum - previousSum) / previousSum;
    if (Math.abs(delta) < 0.2) continue;
    const cat = categories.find((c) => c.id === catId);
    const label = cat ? `${cat.emoji} ${cat.label}` : 'Ohne Kategorie';
    insights.push({
      id: `cat-${catId}`,
      headline: `${label} ${delta > 0 ? 'gestiegen' : 'gesunken'} um ${(delta * 100).toFixed(0)}%`,
      detail: `Aktuell ${formatEuro(currentSum)} (Vormonat ${formatEuro(previousSum)})`,
      trend: delta > 0 ? 'up' : 'down',
      delta,
    });
  }

  // Pro Objekt Vergleich
  const sumByProperty = (target: string) => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const b of bookings) {
      if (!b.propertyId) continue;
      if (!b.date.startsWith(target)) continue;
      const slot = map.get(b.propertyId) ?? { income: 0, expense: 0 };
      if (b.type === 'income') slot.income += b.amount;
      else slot.expense += b.amount;
      map.set(b.propertyId, slot);
    }
    return map;
  };

  const curP = sumByProperty(monthIso);
  const prevP = sumByProperty(prevMonth);
  for (const [propId, c] of curP.entries()) {
    const p = prevP.get(propId) ?? { income: 0, expense: 0 };
    const netCur = c.income - c.expense;
    const netPrev = p.income - p.expense;
    const delta = Math.abs(netPrev) < 1 ? 0 : (netCur - netPrev) / Math.abs(netPrev);
    if (Math.abs(netCur - netPrev) < 100) continue;
    const property = properties.find((pp) => pp.id === propId);
    if (!property) continue;
    insights.push({
      id: `prop-${propId}`,
      headline: `${property.name}: Saldo ${netCur >= netPrev ? 'verbessert' : 'verschlechtert'}`,
      detail: `${formatEuro(netCur)} (Vormonat ${formatEuro(netPrev)})`,
      trend: netCur >= netPrev ? 'up' : 'down',
      delta,
    });
  }

  return insights.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8);
}

/**
 * Q&A — beantwortet eine Freitext-Frage durch Pattern-Matching.
 */
export function answerQuestion(question: string, insights: AnalystInsight[]): string {
  const q = question.toLowerCase();
  if (q.includes('nebenkost') || q.includes('hausgeld') || q.includes('strom') || q.includes('wasser')) {
    const fix = insights.filter(
      (i) => i.id.startsWith('cat-cat-strom') || i.id.startsWith('cat-cat-wasser') || i.id.startsWith('cat-cat-hausgeld'),
    );
    if (fix.length === 0) return 'Keine auffälligen Nebenkosten-Bewegungen gegenüber Vormonat.';
    return fix.map((i) => `• ${i.headline} — ${i.detail}`).join('\n');
  }
  if (q.includes('warum') || q.includes('wieso')) {
    const top3 = insights.slice(0, 3);
    if (top3.length === 0) return 'Aktuell keine Auffälligkeiten gegenüber dem Vormonat.';
    return top3.map((i) => `• ${i.headline} — ${i.detail}`).join('\n');
  }
  return [
    'Frag mich z.B.:',
    '· Warum sind meine Ausgaben höher?',
    '· Wieso sind die Nebenkosten gestiegen?',
    '',
    'Top-Bewegungen aktuell:',
    ...insights.slice(0, 3).map((i) => `• ${i.headline}`),
  ].join('\n');
}
