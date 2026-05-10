import { Booking } from '@/types';

/**
 * F-119 Was-wäre-wenn-Slider — projiziert die Auswirkungen einer
 * prozentualen Reduktion einer Kategorie auf 12 Monate.
 */

export interface WhatIfResult {
  baselineAnnualSpend: number;
  reducedAnnualSpend: number;
  yearlySavings: number;
  cumulativeSavingsByYear: number[]; // 1-5 Jahre
}

export function computeWhatIf(input: {
  bookings: Booking[];
  categoryId: string;
  reductionPercent: number; // 0..1
}): WhatIfResult {
  const { bookings, categoryId, reductionPercent } = input;
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const filtered = bookings.filter(
    (b) => b.type === 'expense' && b.categoryId === categoryId && new Date(b.date) >= cutoff,
  );
  const baseline = filtered.reduce((s, b) => s + b.amount, 0);
  const reduced = baseline * (1 - reductionPercent);
  const savings = baseline - reduced;
  const cumulative = [1, 2, 3, 4, 5].map((y) => savings * y);
  return {
    baselineAnnualSpend: baseline,
    reducedAnnualSpend: reduced,
    yearlySavings: savings,
    cumulativeSavingsByYear: cumulative,
  };
}
