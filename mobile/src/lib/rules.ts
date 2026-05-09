import { Booking, Rule } from '@/types';

/**
 * F-024: Regeln-Engine.
 * Wendet Regeln in der Reihenfolge an und überschreibt nur leere Felder.
 * Die erste Regel, deren Bedingungen ALLE erfüllt sind, gewinnt.
 */
export function applyRules<B extends Partial<Booking>>(
  draft: B,
  rules: Rule[],
): B & { ruleId?: string } {
  for (const rule of rules) {
    if (matchesRule(draft, rule)) {
      const result: B & { ruleId?: string } = { ...draft, ruleId: rule.id };
      if (rule.actions.setCategoryId && !draft.categoryId) {
        result.categoryId = rule.actions.setCategoryId;
      }
      if (rule.actions.setPropertyId && !draft.propertyId) {
        result.propertyId = rule.actions.setPropertyId;
      }
      if (rule.actions.setRecurrence && (!draft.recurrence || draft.recurrence === 'none')) {
        result.recurrence = rule.actions.setRecurrence;
      }
      return result;
    }
  }
  return draft;
}

function matchesRule(draft: Partial<Booking>, rule: Rule): boolean {
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((c) => {
    if (c.field === 'counterparty') {
      const v = String(c.value).toLowerCase();
      return (draft.counterparty ?? '').toLowerCase().includes(v);
    }
    if (c.field === 'note') {
      const v = String(c.value).toLowerCase();
      return (draft.note ?? '').toLowerCase().includes(v);
    }
    if (c.field === 'amountMin') {
      return (draft.amount ?? 0) >= Number(c.value);
    }
    if (c.field === 'amountMax') {
      return (draft.amount ?? 0) <= Number(c.value);
    }
    return false;
  });
}
