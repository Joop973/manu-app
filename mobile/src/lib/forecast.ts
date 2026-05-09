import { Booking, Template } from '@/types';
import { addMonths, monthKey } from './dates';

/**
 * F-038: Vorhersage-Modul (basis).
 * Kombiniert wiederkehrende Templates mit dem Durchschnitt der letzten 6 Monate.
 */

export interface ForecastPoint {
  month: string;
  income: number;
  expense: number;
  balance: number;
  isForecast: boolean;
}

export function buildForecast(
  bookings: Booking[],
  templates: Template[],
  fromMonth: string,
  monthsAhead: number,
): ForecastPoint[] {
  const points: ForecastPoint[] = [];

  // Historisch: 6 Monate zurück
  const history = new Map<string, { income: number; expense: number }>();
  for (let i = -6; i <= -1; i += 1) {
    const m = addMonths(fromMonth, i);
    history.set(m, { income: 0, expense: 0 });
  }
  for (const b of bookings) {
    const m = b.date.slice(0, 7);
    const slot = history.get(m);
    if (!slot) continue;
    if (b.type === 'income') slot.income += b.amount;
    else slot.expense += b.amount;
  }
  for (const [month, vals] of history.entries()) {
    points.push({ month, ...vals, balance: vals.income - vals.expense, isForecast: false });
  }

  // Durchschnitt
  const histArr = [...history.values()];
  const avgIncome = histArr.reduce((s, v) => s + v.income, 0) / Math.max(1, histArr.length);
  const avgExpense = histArr.reduce((s, v) => s + v.expense, 0) / Math.max(1, histArr.length);

  // Forecast: nächste N Monate
  for (let i = 0; i < monthsAhead; i += 1) {
    const m = addMonths(fromMonth, i);
    let income = 0;
    let expense = 0;
    for (const tpl of templates) {
      if (tpl.recurrence === 'monthly') {
        if (tpl.type === 'income') income += tpl.amount;
        else expense += tpl.amount;
      } else if (tpl.recurrence === 'yearly') {
        if (tpl.type === 'income') income += tpl.amount / 12;
        else expense += tpl.amount / 12;
      }
    }
    // Mische mit historischem Durchschnitt für Volatilitäts-Posten
    const blendedIncome = income > 0 ? income : avgIncome;
    const blendedExpense = expense > 0 ? expense : avgExpense;
    points.push({
      month: m,
      income: Math.round(blendedIncome),
      expense: Math.round(blendedExpense),
      balance: Math.round(blendedIncome - blendedExpense),
      isForecast: true,
    });
  }

  return points;
}

export function buildYearStats(
  bookings: Booking[],
  year: number,
): { months: { month: string; income: number; expense: number }[]; income: number; expense: number; profit: number; margin: number; topCategories: { categoryId: string | null; sum: number }[] } {
  const months: { month: string; income: number; expense: number }[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    months.push({ month: key, income: 0, expense: 0 });
  }
  let income = 0;
  let expense = 0;
  const catSums = new Map<string | null, number>();
  for (const b of bookings) {
    if (!b.date.startsWith(String(year))) continue;
    const m = Number(b.date.slice(5, 7)) - 1;
    if (b.type === 'income') {
      months[m].income += b.amount;
      income += b.amount;
    } else {
      months[m].expense += b.amount;
      expense += b.amount;
      const k = b.categoryId ?? null;
      catSums.set(k, (catSums.get(k) ?? 0) + b.amount);
    }
  }
  const profit = income - expense;
  const margin = income > 0 ? profit / income : 0;
  const topCategories = [...catSums.entries()]
    .map(([categoryId, sum]) => ({ categoryId, sum }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 6);
  return { months, income, expense, profit, margin, topCategories };
}

export { monthKey };
