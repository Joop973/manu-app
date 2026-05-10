import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { Booking, Category, Property, Tenant } from '@/types';
import { formatEuro } from './calc';
import { uid } from './id';

/**
 * F-111 Custom Report Generator — erstellt PDF (via expo-print) oder CSV
 * für einen Zeitraum, optional gefiltert nach Objekt / Kategorie.
 */

export interface ReportFilter {
  fromDate: string;
  toDate: string;
  propertyIds?: string[] | null;
  categoryIds?: string[] | null;
}

interface ReportInputs extends ReportFilter {
  bookings: Booking[];
  properties: Property[];
  categories: Category[];
  tenants?: Tenant[];
  title?: string;
}

function filteredBookings(input: ReportInputs): Booking[] {
  return input.bookings.filter((b) => {
    if (b.date < input.fromDate || b.date > input.toDate) return false;
    if (input.propertyIds?.length && !input.propertyIds.includes(b.propertyId ?? '')) return false;
    if (input.categoryIds?.length && !input.categoryIds.includes(b.categoryId ?? '')) return false;
    return true;
  });
}

export async function exportCsv(input: ReportInputs): Promise<string> {
  const bookings = filteredBookings(input);
  const propertyById = new Map(input.properties.map((p) => [p.id, p.name]));
  const categoryById = new Map(input.categories.map((c) => [c.id, c.label]));
  const lines = [
    'Datum;Typ;Betrag;Empfänger;Kategorie;Objekt;Notiz',
  ];
  for (const b of bookings) {
    const cells = [
      b.date,
      b.type === 'income' ? 'Einnahme' : 'Ausgabe',
      b.amount.toFixed(2).replace('.', ','),
      escape(b.counterparty),
      escape(b.categoryId ? categoryById.get(b.categoryId) : ''),
      escape(b.propertyId ? propertyById.get(b.propertyId) : ''),
      escape(b.note),
    ];
    lines.push(cells.join(';'));
  }
  const csvText = lines.join('\n');
  const path = `${FileSystem.documentDirectory}${uid('csv')}.csv`;
  await FileSystem.writeAsStringAsync(path, csvText);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
  return path;
}

function escape(s?: string | null): string {
  if (!s) return '';
  return `"${s.replace(/"/g, '""')}"`;
}

export async function exportPdf(input: ReportInputs): Promise<string> {
  const bookings = filteredBookings(input);
  const totalIncome = bookings.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0);
  const totalExpense = bookings.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
  const propertyById = new Map(input.properties.map((p) => [p.id, p.name]));
  const categoryById = new Map(input.categories.map((c) => [c.id, `${c.emoji} ${c.label}`]));

  const tableRows = bookings
    .map((b) => {
      const isIncome = b.type === 'income';
      return `<tr>
          <td>${b.date}</td>
          <td>${isIncome ? '+' : '−'} ${formatEuro(b.amount)}</td>
          <td>${b.counterparty ?? ''}</td>
          <td>${b.categoryId ? categoryById.get(b.categoryId) : ''}</td>
          <td>${b.propertyId ? propertyById.get(b.propertyId) : ''}</td>
          <td>${b.note ?? ''}</td>
        </tr>`;
    })
    .join('');

  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, sans-serif; color: #1a1a1a; padding: 32px; }
          h1 { font-size: 22px; color: #8a6d1d; letter-spacing: 1px; }
          h2 { font-size: 14px; color: #8a6d1d; margin-top: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
          th, td { border-bottom: 1px solid #e0d59f; padding: 6px 8px; text-align: left; }
          th { background: #f6efce; }
          .kpi-row { display: flex; gap: 12px; margin-top: 8px; }
          .kpi { flex: 1; padding: 12px; border: 1px solid #e0d59f; border-radius: 8px; background: #fafaf6; }
          .kpi small { color: #888; }
          .kpi b { font-size: 16px; }
          .income { color: #2D8A4E; }
          .expense { color: #C9302C; }
        </style>
      </head>
      <body>
        <h1>Manu Imperial Finance — Report</h1>
        <p>${input.title ?? 'Berichtszeitraum'}: ${input.fromDate} bis ${input.toDate}</p>
        <div class="kpi-row">
          <div class="kpi"><small>Einnahmen</small><br/><b class="income">${formatEuro(totalIncome)}</b></div>
          <div class="kpi"><small>Ausgaben</small><br/><b class="expense">${formatEuro(totalExpense)}</b></div>
          <div class="kpi"><small>Saldo</small><br/><b>${formatEuro(totalIncome - totalExpense)}</b></div>
        </div>
        <h2>Buchungen (${bookings.length})</h2>
        <table>
          <thead><tr><th>Datum</th><th>Betrag</th><th>Empfänger</th><th>Kategorie</th><th>Objekt</th><th>Notiz</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="margin-top: 24px; font-size: 10px; color: #888;">
          Generiert mit Manu Imperial Finance · ${new Date().toLocaleString('de-DE')}
        </p>
      </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}

/**
 * F-039 Monatsreport — kompakte PDF-Zusammenfassung des Vormonats:
 * Top-Buchungen, Mietstatus, Fixkosten-Vergleich.
 */
export async function exportMonthlyOverviewPdf(input: {
  bookings: Booking[];
  properties: Property[];
  categories: Category[];
  tenants?: Tenant[];
  monthIso: string;
}): Promise<string> {
  const { bookings, properties, categories, tenants = [], monthIso } = input;
  const monthBookings = bookings.filter((b) => b.date.startsWith(monthIso));
  const income = monthBookings.filter((b) => b.type === 'income').reduce((s, b) => s + b.amount, 0);
  const expense = monthBookings.filter((b) => b.type === 'expense').reduce((s, b) => s + b.amount, 0);

  const propertyById = new Map(properties.map((p) => [p.id, p.name]));
  const categoryById = new Map(categories.map((c) => [c.id, `${c.emoji} ${c.label}`]));

  const top5Expense = monthBookings
    .filter((b) => b.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const tenantStatus = tenants.map((t) => {
    const paid = monthBookings.find(
      (b) =>
        b.type === 'income' &&
        b.categoryId === 'cat-miete' &&
        (b.counterparty ?? '').trim().toLowerCase() === t.name.trim().toLowerCase(),
    );
    return { name: t.name, paid: !!paid, amount: paid?.amount ?? 0, expected: t.rentCold ?? t.rentWarm ?? 0 };
  });

  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, sans-serif; padding: 32px; color: #1a1a1a; }
          h1 { color: #8a6d1d; }
          h2 { color: #8a6d1d; margin-top: 22px; font-size: 14px; }
          .kpi-row { display: flex; gap: 12px; margin-top: 8px; }
          .kpi { flex: 1; padding: 12px; border: 1px solid #e0d59f; border-radius: 8px; background: #fafaf6; }
          .income { color: #2D8A4E; }
          .expense { color: #C9302C; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
          th, td { border-bottom: 1px solid #e0d59f; padding: 5px 8px; text-align: left; }
          th { background: #f6efce; }
          .ok { color: #2D8A4E; }
          .miss { color: #C9302C; }
        </style>
      </head>
      <body>
        <h1>Manu Imperial Finance — Monatsreport ${monthIso}</h1>
        <div class="kpi-row">
          <div class="kpi"><small>Einnahmen</small><br/><b class="income">${formatEuro(income)}</b></div>
          <div class="kpi"><small>Ausgaben</small><br/><b class="expense">${formatEuro(expense)}</b></div>
          <div class="kpi"><small>Saldo</small><br/><b>${formatEuro(income - expense)}</b></div>
        </div>

        <h2>Top-5 Ausgaben</h2>
        <table>
          <thead><tr><th>Datum</th><th>Empfänger</th><th>Kategorie</th><th>Objekt</th><th>Betrag</th></tr></thead>
          <tbody>
            ${top5Expense
              .map(
                (b) => `<tr>
                  <td>${b.date}</td>
                  <td>${b.counterparty ?? ''}</td>
                  <td>${b.categoryId ? categoryById.get(b.categoryId) : ''}</td>
                  <td>${b.propertyId ? propertyById.get(b.propertyId) : ''}</td>
                  <td>${formatEuro(b.amount)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>

        ${
          tenantStatus.length > 0
            ? `<h2>Mietstatus</h2>
               <table>
                 <thead><tr><th>Mieter</th><th>Erwartet</th><th>Erhalten</th><th>Status</th></tr></thead>
                 <tbody>
                   ${tenantStatus
                     .map(
                       (s) => `<tr>
                         <td>${s.name}</td>
                         <td>${s.expected ? formatEuro(s.expected) : '—'}</td>
                         <td>${s.paid ? formatEuro(s.amount) : '—'}</td>
                         <td class="${s.paid ? 'ok' : 'miss'}">${s.paid ? '✓ bezahlt' : '⚠ offen'}</td>
                       </tr>`,
                     )
                     .join('')}
                 </tbody>
               </table>`
            : ''
        }

        <p style="margin-top: 24px; font-size: 10px; color: #888;">
          Generiert mit Manu Imperial Finance · ${new Date().toLocaleString('de-DE')}
        </p>
      </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}
