import { Booking, MaintenanceLog, Property, Tenant } from '@/types';
import { addMonths, isInMonth } from './dates';

/**
 * F-102 Property-by-Property P&L — pro Objekt eine kompakte
 * Mini-Bilanz für 1, 3, 12 Monate.
 */

export interface PropertyProfitLoss {
  property: Property;
  income: { m1: number; m3: number; y1: number };
  expense: { m1: number; m3: number; y1: number };
  net: { m1: number; m3: number; y1: number };
  bookingCount: number;
  tenantCount: number;
  maintenanceCount: number;
  vacancyMonths?: number;
}

export function buildPropertyPnL(input: {
  property: Property;
  bookings: Booking[];
  tenants: Tenant[];
  maintenance: MaintenanceLog[];
  monthIso: string;
}): PropertyProfitLoss {
  const { property, bookings, tenants, maintenance, monthIso } = input;

  const matching = bookings.filter((b) => b.propertyId === property.id);
  const months3 = [monthIso, addMonths(monthIso, -1), addMonths(monthIso, -2)];
  const months12 = Array.from({ length: 12 }, (_, i) => addMonths(monthIso, -i));

  const sumIncome = (months: string[]) =>
    matching
      .filter((b) => b.type === 'income' && months.some((m) => isInMonth(b.date, m)))
      .reduce((s, b) => s + b.amount, 0);
  const sumExpense = (months: string[]) =>
    matching
      .filter((b) => b.type === 'expense' && months.some((m) => isInMonth(b.date, m)))
      .reduce((s, b) => s + b.amount, 0);

  const inc1 = sumIncome([monthIso]);
  const inc3 = sumIncome(months3);
  const inc12 = sumIncome(months12);
  const exp1 = sumExpense([monthIso]);
  const exp3 = sumExpense(months3);
  const exp12 = sumExpense(months12);

  const propertyTenants = tenants.filter((t) => t.propertyId === property.id);
  const propertyMaint = maintenance.filter((m) => m.propertyId === property.id);

  // Leerstand grob: Monate ohne Mietzahlung in den letzten 12 Monaten
  const monthsWithRent = new Set(
    matching
      .filter((b) => b.type === 'income' && b.categoryId === 'cat-miete')
      .map((b) => b.date.slice(0, 7)),
  );
  const vacancyMonths = months12.filter((m) => !monthsWithRent.has(m)).length;

  return {
    property,
    income: { m1: inc1, m3: inc3, y1: inc12 },
    expense: { m1: exp1, m3: exp3, y1: exp12 },
    net: { m1: inc1 - exp1, m3: inc3 - exp3, y1: inc12 - exp12 },
    bookingCount: matching.length,
    tenantCount: propertyTenants.length,
    maintenanceCount: propertyMaint.length,
    vacancyMonths,
  };
}

/**
 * F-103 Tenant Payment Timeline — letzte 12 Monatszahlungen + Verzugs-Status.
 */
export interface TenantTimelinePoint {
  monthIso: string;
  paidAmount: number;
  expected: number;
  status: 'paid' | 'partial' | 'missing';
}

export function buildTenantTimeline(input: {
  tenant: Tenant;
  bookings: Booking[];
  monthIso: string;
}): TenantTimelinePoint[] {
  const { tenant, bookings, monthIso } = input;
  const expected = tenant.rentCold ?? tenant.rentWarm ?? 0;
  const months: string[] = [];
  for (let i = 11; i >= 0; i -= 1) months.push(addMonths(monthIso, -i));
  const lower = tenant.name.trim().toLowerCase();
  return months.map((m) => {
    const paid = bookings
      .filter(
        (b) =>
          b.type === 'income' &&
          b.categoryId === 'cat-miete' &&
          (b.counterparty ?? '').trim().toLowerCase() === lower &&
          b.date.startsWith(m),
      )
      .reduce((s, b) => s + b.amount, 0);
    let status: TenantTimelinePoint['status'] = 'missing';
    if (expected > 0 && paid >= expected * 0.95) status = 'paid';
    else if (paid > 0) status = 'partial';
    return { monthIso: m, paidAmount: paid, expected, status };
  });
}

/**
 * F-110 Utility Meter Trending — Anomalie-Detection auf Basis der
 * vorhandenen MeterReadings (greift in den existing Store).
 */
export interface MeterTrendPoint {
  date: string;
  value: number;
  diff: number;
}

export function buildMeterTrend(values: { date: string; value: number }[]): MeterTrendPoint[] {
  const sorted = values.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((v, i) => ({
    date: v.date,
    value: v.value,
    diff: i === 0 ? 0 : v.value - sorted[i - 1].value,
  }));
}
