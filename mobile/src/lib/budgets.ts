import { Booking, Budget, Category } from '@/types';

/**
 * F-113 Envelope Budgeting — Soll/Ist pro Kategorie + Monat.
 * F-116 Adaptive Budgeting — Vorschläge zur Anpassung basierend auf 3-Monats-Schnitt.
 */

export interface BudgetStatus {
  budget: Budget;
  category?: Category;
  spent: number;
  limit: number;
  remaining: number;
  percent: number;
  state: 'ok' | 'warning' | 'over';
}

export function evaluateBudgets(input: {
  budgets: Budget[];
  bookings: Booking[];
  categories: Category[];
  monthIso: string;
}): BudgetStatus[] {
  const { budgets, bookings, categories, monthIso } = input;
  const result: BudgetStatus[] = [];
  for (const b of budgets) {
    const spent = bookings
      .filter(
        (bk) => bk.type === 'expense' && bk.categoryId === b.categoryId && bk.date.startsWith(monthIso),
      )
      .reduce((s, bk) => s + bk.amount, 0);
    const remaining = b.monthlyLimit - spent;
    const percent = b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0;
    const state: BudgetStatus['state'] = percent >= 1 ? 'over' : percent >= 0.8 ? 'warning' : 'ok';
    result.push({
      budget: b,
      category: categories.find((c) => c.id === b.categoryId),
      spent,
      limit: b.monthlyLimit,
      remaining,
      percent,
      state,
    });
  }
  return result;
}

export interface BudgetSuggestion {
  categoryId: string;
  categoryLabel: string;
  currentLimit?: number;
  suggestedLimit: number;
  reason: string;
}

export function suggestBudgetAdjustments(input: {
  budgets: Budget[];
  bookings: Booking[];
  categories: Category[];
  monthIso: string;
}): BudgetSuggestion[] {
  const { budgets, bookings, categories, monthIso } = input;
  const suggestions: BudgetSuggestion[] = [];
  // 3-Monats-Schnitt pro Kategorie
  const tally = new Map<string, number>();
  const monthsBack = previousNMonths(monthIso, 3);
  for (const b of bookings) {
    if (b.type !== 'expense' || !b.categoryId) continue;
    if (!monthsBack.includes(b.date.slice(0, 7))) continue;
    tally.set(b.categoryId, (tally.get(b.categoryId) ?? 0) + b.amount);
  }
  for (const [catId, sum] of tally.entries()) {
    const avg = sum / 3;
    if (avg < 5) continue;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) continue;
    const existing = budgets.find((b) => b.categoryId === catId);
    if (!existing) {
      suggestions.push({
        categoryId: catId,
        categoryLabel: `${cat.emoji} ${cat.label}`,
        suggestedLimit: Math.ceil(avg / 10) * 10,
        reason: `Du gibst im Schnitt ${avg.toFixed(0)} €/Monat aus, aber kein Budget gesetzt.`,
      });
    } else {
      const drift = avg / existing.monthlyLimit;
      if (drift > 1.2) {
        suggestions.push({
          categoryId: catId,
          categoryLabel: `${cat.emoji} ${cat.label}`,
          currentLimit: existing.monthlyLimit,
          suggestedLimit: Math.ceil(avg / 10) * 10,
          reason: `Aktuelles Budget liegt ${((drift - 1) * 100).toFixed(0)}% unter realer Ausgabe.`,
        });
      } else if (drift < 0.7) {
        suggestions.push({
          categoryId: catId,
          categoryLabel: `${cat.emoji} ${cat.label}`,
          currentLimit: existing.monthlyLimit,
          suggestedLimit: Math.ceil(avg / 10) * 10,
          reason: `Du brauchst nur ${(drift * 100).toFixed(0)}% des Budgets — kannst es senken.`,
        });
      }
    }
  }
  return suggestions;
}

function previousNMonths(monthIso: string, n: number): string[] {
  const [y, m] = monthIso.split('-').map(Number);
  const list: string[] = [];
  for (let i = 1; i <= n; i += 1) {
    const d = new Date(y, m - 1 - i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return list;
}
