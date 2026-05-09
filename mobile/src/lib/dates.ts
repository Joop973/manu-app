export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function startOfMonth(monthIso: string): Date {
  const [year, month] = monthIso.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function endOfMonth(monthIso: string): Date {
  const [year, month] = monthIso.split('-').map(Number);
  return new Date(year, month, 0, 23, 59, 59, 999);
}

export function addMonths(monthIso: string, delta: number): string {
  const [year, month] = monthIso.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return monthKey(d);
}

const MONTH_LABEL_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export function monthLabel(monthIso: string): string {
  const [year, month] = monthIso.split('-').map(Number);
  return `${MONTH_LABEL_DE[month - 1]} ${year}`;
}

export function isInMonth(dateIso: string, monthIso: string): boolean {
  return dateIso.startsWith(monthIso);
}

export function formatDateDe(dateIso: string): string {
  const [year, month, day] = dateIso.split('-');
  return `${day}.${month}.${year}`;
}
