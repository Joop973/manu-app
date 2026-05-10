import { Booking, Subscription, Template } from '@/types';
import { addMonths, monthKey } from './dates';
import { annualCost } from './subscriptions';

/**
 * F-105 Leftover Daily-Spend — wieviel ist heute noch verfügbar?
 * Formel: (aktueller Saldo des Monats + erwartete Einnahmen - geplante
 * verbleibende Ausgaben) / Tage bis Monatsende
 */
export interface LeftoverResult {
  saldoToday: number;
  expectedIncomeRemaining: number;
  expectedExpenseRemaining: number;
  totalAvailable: number;
  daysRemaining: number;
  perDay: number;
}

export function computeLeftover(input: {
  bookings: Booking[];
  templates: Template[];
  subscriptions: Subscription[];
  today: Date;
}): LeftoverResult {
  const { bookings, templates, subscriptions, today } = input;
  const monthIso = monthKey(today);
  const inMonth = bookings.filter((b) => b.date.startsWith(monthIso));
  const income = inMonth.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0);
  const expense = inMonth.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
  const saldoToday = income - expense;

  // Templates: nur die monatlichen mit definierter Wiederholung
  const recurringIncome = templates
    .filter((t) => t.recurrence === 'monthly' && t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const recurringExpense = templates
    .filter((t) => t.recurrence === 'monthly' && t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  // Anteil bereits gezahlter wiederkehrender Buchungen → ziehen wir vom Erwartungswert ab
  const seenRecurringIncome = inMonth
    .filter((b) => b.type === 'income' && b.templateId)
    .reduce((s, b) => s + b.amount, 0);
  const seenRecurringExpense = inMonth
    .filter((b) => b.type === 'expense' && b.templateId)
    .reduce((s, b) => s + b.amount, 0);

  // Aktive Abos: Monatsrate (Yearly geteilt durch 12) als Schätzwert
  const subsExpense = subscriptions
    .filter((s) => s.active)
    .reduce((sum, s) => sum + annualCost(s) / 12, 0);

  const expectedIncomeRemaining = Math.max(0, recurringIncome - seenRecurringIncome);
  const expectedExpenseRemaining = Math.max(0, recurringExpense + subsExpense - seenRecurringExpense);

  const daysRemaining = daysToEndOfMonth(today);
  const totalAvailable = saldoToday + expectedIncomeRemaining - expectedExpenseRemaining;
  const perDay = daysRemaining > 0 ? totalAvailable / daysRemaining : totalAvailable;

  return {
    saldoToday,
    expectedIncomeRemaining,
    expectedExpenseRemaining,
    totalAvailable,
    daysRemaining,
    perDay,
  };
}

function daysToEndOfMonth(date: Date): number {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return Math.max(1, Math.ceil((end.getTime() - date.getTime()) / 86400000));
}

/**
 * F-106 Cash-Flow-Projection — kombiniert Templates + Subscriptions
 * für die nächsten N Monate, jeweils als Saldo-Verlauf.
 */
export interface CashflowPoint {
  month: string;
  income: number;
  expense: number;
  balance: number;
  cumulative: number;
}

export function projectCashflow(input: {
  bookings: Booking[];
  templates: Template[];
  subscriptions: Subscription[];
  startMonth: string;
  monthsAhead: number;
}): CashflowPoint[] {
  const { templates, subscriptions, startMonth, monthsAhead, bookings } = input;
  const points: CashflowPoint[] = [];

  // historischer Durchschnitt der letzten 6 Monate (Polster für Volatilität)
  const histExpenseAvg = avgMonthlyExpenseExclTemplates(bookings, startMonth, 6);

  let cumulative = 0;
  const startSaldo = bookings.reduce(
    (s, b) => s + (b.type === 'income' ? b.amount : -b.amount),
    0,
  );
  cumulative = startSaldo;

  for (let i = 0; i < monthsAhead; i += 1) {
    const m = addMonths(startMonth, i);
    let income = 0;
    let expense = 0;
    for (const t of templates) {
      if (t.recurrence === 'monthly') {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      } else if (t.recurrence === 'yearly') {
        if (t.type === 'income') income += t.amount / 12;
        else expense += t.amount / 12;
      }
    }
    for (const s of subscriptions) {
      if (!s.active) continue;
      expense += annualCost(s) / 12;
    }
    expense += Math.max(0, histExpenseAvg);
    const balance = income - expense;
    cumulative += balance;
    points.push({ month: m, income, expense, balance, cumulative });
  }
  return points;
}

function avgMonthlyExpenseExclTemplates(bookings: Booking[], startMonth: string, monthsBack: number) {
  const months: string[] = [];
  for (let i = 1; i <= monthsBack; i += 1) months.push(addMonths(startMonth, -i));
  const filtered = bookings.filter(
    (b) => b.type === 'expense' && !b.templateId && months.includes(b.date.slice(0, 7)),
  );
  const sum = filtered.reduce((s, b) => s + b.amount, 0);
  return sum / monthsBack;
}
