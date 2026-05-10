import { DebtPlan, Liability } from '@/types';

/**
 * F-117 Debt-Payoff-Planner — berechnet Restlaufzeit + Gesamtzinsen
 * für eine fixe monatliche Rate (Annuitätenmodell).
 */

export interface PayoffResult {
  monthsToPayoff: number;
  yearsToPayoff: number;
  totalInterest: number;
  totalPaid: number;
  schedule: { month: number; interest: number; principal: number; balance: number }[];
}

export function projectPayoff(input: {
  balance: number;
  annualRatePercent: number;
  monthlyPayment: number;
  maxMonths?: number;
}): PayoffResult {
  const { balance, annualRatePercent, monthlyPayment } = input;
  const maxMonths = input.maxMonths ?? 600;
  const monthlyRate = annualRatePercent / 100 / 12;
  let remaining = balance;
  let totalInterest = 0;
  const schedule: PayoffResult['schedule'] = [];
  for (let month = 1; month <= maxMonths && remaining > 0.01; month += 1) {
    const interest = remaining * monthlyRate;
    let principal = monthlyPayment - interest;
    if (principal < 0) principal = 0;
    if (principal > remaining) principal = remaining;
    remaining -= principal;
    totalInterest += interest;
    schedule.push({ month, interest, principal, balance: remaining });
    if (monthlyPayment <= interest) break;
  }
  const monthsToPayoff = schedule[schedule.length - 1]?.month ?? 0;
  return {
    monthsToPayoff,
    yearsToPayoff: monthsToPayoff / 12,
    totalInterest,
    totalPaid: balance + totalInterest,
    schedule,
  };
}

export function summarizeDebtPlan(plan: DebtPlan, liability: Liability): PayoffResult {
  return projectPayoff({
    balance: liability.balance,
    annualRatePercent: liability.interestRate ?? 0,
    monthlyPayment: plan.monthlyPayment,
  });
}
