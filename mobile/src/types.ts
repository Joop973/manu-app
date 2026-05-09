export type BookingType = 'income' | 'expense';

export type Recurrence = 'none' | 'monthly' | 'yearly';

export interface Property {
  id: string;
  name: string;
  address?: string;
  description?: string;
  notes?: string;
  color: string;
  createdAt: string;
}

export interface Category {
  id: string;
  label: string;
  emoji: string;
  builtin?: boolean;
}

export interface Booking {
  id: string;
  type: BookingType;
  amount: number;
  date: string;
  propertyId: string | null;
  categoryId: string | null;
  counterparty?: string;
  note?: string;
  recurrence: Recurrence;
  autoBook?: boolean;
  templateId?: string;
  ruleId?: string;
  receiptId?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  label: string;
  type: BookingType;
  amount: number;
  propertyId: string | null;
  categoryId: string | null;
  counterparty?: string;
  note?: string;
  recurrence: Recurrence;
  createdAt: string;
}

export type RuleConditionField = 'counterparty' | 'note' | 'amountMin' | 'amountMax';

export interface RuleCondition {
  field: RuleConditionField;
  value: string | number;
}

export interface RuleAction {
  setCategoryId?: string;
  setPropertyId?: string;
  setRecurrence?: Recurrence;
}

export interface Rule {
  id: string;
  label: string;
  conditions: RuleCondition[];
  actions: RuleAction;
  createdAt: string;
}
