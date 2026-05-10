import { Tenant, VacancyMark } from '@/types';

/**
 * F-045 Leerstandstracker — erkennt Lücken in der Mieter-Vertragslandschaft
 * pro Objekt und schätzt die entgangene Miete.
 */

export interface VacancyPeriod {
  fromDate: string;
  toDate: string;
  days: number;
  estimatedLoss: number;
  reason: 'gap' | 'planned' | 'unplanned';
  notes?: string;
}

export function buildVacancyPeriods(input: {
  propertyId: string;
  tenants: Tenant[];
  vacancies: VacancyMark[];
  asOfDate?: string;
}): VacancyPeriod[] {
  const today = input.asOfDate ?? new Date().toISOString().slice(0, 10);
  const propertyTenants = input.tenants
    .filter((t) => t.propertyId === input.propertyId && t.contractStart)
    .sort((a, b) => (a.contractStart! < b.contractStart! ? -1 : 1));

  const periods: VacancyPeriod[] = [];

  // Gaps zwischen Verträgen
  for (let i = 0; i < propertyTenants.length - 1; i += 1) {
    const cur = propertyTenants[i];
    const next = propertyTenants[i + 1];
    if (!cur.contractEnd || !next.contractStart) continue;
    if (cur.contractEnd >= next.contractStart) continue;
    const days = daysBetween(cur.contractEnd, next.contractStart);
    if (days <= 0) continue;
    const dailyRent = (cur.rentCold ?? 0) / 30;
    periods.push({
      fromDate: cur.contractEnd,
      toDate: next.contractStart,
      days,
      estimatedLoss: Math.round(dailyRent * days),
      reason: 'gap',
    });
  }

  // Aktueller Leerstand: letzter Vertrag ist beendet, kein Nachfolger
  const last = propertyTenants[propertyTenants.length - 1];
  if (last && last.contractEnd && last.contractEnd < today) {
    const days = daysBetween(last.contractEnd, today);
    if (days >= 1) {
      const dailyRent = (last.rentCold ?? 0) / 30;
      periods.push({
        fromDate: last.contractEnd,
        toDate: today,
        days,
        estimatedLoss: Math.round(dailyRent * days),
        reason: 'unplanned',
      });
    }
  }

  // Manuelle Markierungen (geplant / ungeplant) erweitern die Liste
  const marks = input.vacancies.filter((v) => v.propertyId === input.propertyId);
  for (const v of marks) {
    const to = v.toDate ?? today;
    const days = daysBetween(v.fromDate, to);
    periods.push({
      fromDate: v.fromDate,
      toDate: to,
      days: Math.max(0, days),
      estimatedLoss: 0,
      reason: v.reason === 'planned' ? 'planned' : 'unplanned',
      notes: v.notes,
    });
  }

  return periods.sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function totalVacancy(periods: VacancyPeriod[]): { days: number; loss: number } {
  return periods.reduce(
    (acc, p) => ({ days: acc.days + p.days, loss: acc.loss + p.estimatedLoss }),
    { days: 0, loss: 0 },
  );
}
