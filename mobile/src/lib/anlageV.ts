import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Booking, Property } from '@/types';
import { formatEuro } from './calc';

/**
 * F-041 Steuerreport Anlage V — Aufstellung pro Objekt + Jahr,
 * gegliedert nach den Anlage-V-Zeilen 2026 (Schätzung).
 */

const ZEILEN_INCOME = {
  miete: 'Zeile 9 — Mieteinnahmen (ohne Umsatzsteuer)',
  nk: 'Zeile 12 — Umlagen / Nebenkostenvorauszahlungen',
  sonstige: 'Zeile 15 — Sonstige Einnahmen',
};

const ZEILEN_EXPENSE = {
  abschreibung: 'Zeile 35 — Absetzung für Abnutzung (AfA)',
  schuldzinsen: 'Zeile 36 — Schuldzinsen',
  reparatur: 'Zeile 39 — Erhaltungsaufwand / Reparaturen',
  betrieb: 'Zeile 47 — Sonstige Werbungskosten (Strom, Wasser, Hausgeld …)',
  versicherung: 'Zeile 47 — Versicherungen',
  verwaltung: 'Zeile 47 — Verwaltungskosten',
};

interface Input {
  property: Property;
  bookings: Booking[];
  year: number;
}

export interface AnlageVResult {
  property: Property;
  year: number;
  income: Record<keyof typeof ZEILEN_INCOME, { label: string; sum: number }>;
  expense: Record<keyof typeof ZEILEN_EXPENSE, { label: string; sum: number }>;
  afaAnnual: number;
  totalIncome: number;
  totalExpense: number;
  vermietungsErgebnis: number;
}

const CATEGORY_TO_ANLAGE_INCOME: Record<string, keyof typeof ZEILEN_INCOME> = {
  'cat-miete': 'miete',
};

const CATEGORY_TO_ANLAGE_EXPENSE: Record<string, keyof typeof ZEILEN_EXPENSE> = {
  'cat-strom': 'betrieb',
  'cat-wasser': 'betrieb',
  'cat-hausgeld': 'verwaltung',
  'cat-reparatur': 'reparatur',
  'cat-internet': 'betrieb',
  'cat-versicherung': 'versicherung',
  'cat-kredit': 'schuldzinsen',
  'cat-gez': 'betrieb',
  'cat-reinigung': 'verwaltung',
  'cat-garten': 'betrieb',
};

export function computeAnlageV(input: Input): AnlageVResult {
  const { property, bookings, year } = input;
  const ofYear = bookings.filter(
    (b) => b.propertyId === property.id && b.date.startsWith(String(year)),
  );

  const income: AnlageVResult['income'] = {
    miete: { label: ZEILEN_INCOME.miete, sum: 0 },
    nk: { label: ZEILEN_INCOME.nk, sum: 0 },
    sonstige: { label: ZEILEN_INCOME.sonstige, sum: 0 },
  };
  const expense: AnlageVResult['expense'] = {
    abschreibung: { label: ZEILEN_EXPENSE.abschreibung, sum: 0 },
    schuldzinsen: { label: ZEILEN_EXPENSE.schuldzinsen, sum: 0 },
    reparatur: { label: ZEILEN_EXPENSE.reparatur, sum: 0 },
    betrieb: { label: ZEILEN_EXPENSE.betrieb, sum: 0 },
    versicherung: { label: ZEILEN_EXPENSE.versicherung, sum: 0 },
    verwaltung: { label: ZEILEN_EXPENSE.verwaltung, sum: 0 },
  };

  for (const b of ofYear) {
    if (b.type === 'income') {
      const key = (b.categoryId && CATEGORY_TO_ANLAGE_INCOME[b.categoryId]) ?? 'sonstige';
      income[key].sum += b.amount;
    } else {
      const key = (b.categoryId && CATEGORY_TO_ANLAGE_EXPENSE[b.categoryId]) ?? 'betrieb';
      expense[key].sum += b.amount;
    }
  }

  let afaAnnual = 0;
  if (property.afa?.acquisitionValue && property.afa.ratePercent) {
    afaAnnual = (property.afa.acquisitionValue * property.afa.ratePercent) / 100;
    expense.abschreibung.sum += afaAnnual;
  }

  const totalIncome = Object.values(income).reduce((s, v) => s + v.sum, 0);
  const totalExpense = Object.values(expense).reduce((s, v) => s + v.sum, 0);

  return {
    property,
    year,
    income,
    expense,
    afaAnnual,
    totalIncome,
    totalExpense,
    vermietungsErgebnis: totalIncome - totalExpense,
  };
}

export async function exportAnlageVPdf(result: AnlageVResult): Promise<string> {
  const incomeRows = Object.values(result.income)
    .filter((v) => v.sum > 0)
    .map((v) => `<tr><td>${v.label}</td><td>${formatEuro(v.sum)}</td></tr>`)
    .join('');
  const expenseRows = Object.values(result.expense)
    .filter((v) => v.sum > 0)
    .map((v) => `<tr><td>${v.label}</td><td>${formatEuro(v.sum)}</td></tr>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, sans-serif; padding: 32px; color: #1a1a1a; }
      h1 { color: #8a6d1d; }
      h2 { color: #8a6d1d; margin-top: 22px; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
      th, td { border-bottom: 1px solid #e0d59f; padding: 5px 8px; text-align: left; }
      th { background: #f6efce; }
      .total { font-weight: bold; background: #fafaf6; }
      .income { color: #2D8A4E; }
      .expense { color: #C9302C; }
    </style></head>
    <body>
      <h1>Anlage V — ${result.property.name} · ${result.year}</h1>
      <p>${result.property.address ?? ''}</p>

      <h2>Einnahmen</h2>
      <table>
        <thead><tr><th>Position</th><th>Betrag</th></tr></thead>
        <tbody>
          ${incomeRows || '<tr><td colspan="2"><i>Keine Einnahmen erfasst</i></td></tr>'}
          <tr class="total"><td>Summe Einnahmen</td><td class="income">${formatEuro(result.totalIncome)}</td></tr>
        </tbody>
      </table>

      <h2>Werbungskosten</h2>
      <table>
        <thead><tr><th>Position</th><th>Betrag</th></tr></thead>
        <tbody>
          ${expenseRows || '<tr><td colspan="2"><i>Keine Werbungskosten</i></td></tr>'}
          <tr class="total"><td>Summe Werbungskosten</td><td class="expense">${formatEuro(result.totalExpense)}</td></tr>
        </tbody>
      </table>

      ${result.afaAnnual > 0 ? `<p><b>AfA enthalten:</b> ${formatEuro(result.afaAnnual)} (= ${result.property.afa?.acquisitionValue} € × ${result.property.afa?.ratePercent}%)</p>` : ''}

      <h2>Ergebnis</h2>
      <table>
        <tbody>
          <tr class="total">
            <td>Einkünfte aus Vermietung und Verpachtung</td>
            <td class="${result.vermietungsErgebnis >= 0 ? 'income' : 'expense'}">${formatEuro(result.vermietungsErgebnis)}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top: 24px; font-size: 10px; color: #888;">
        Manu Imperial Finance · Hilfsdokument für Anlage V — KEINE rechtsverbindliche Steuererklärung.
      </p>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}
