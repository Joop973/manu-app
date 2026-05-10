import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Booking, DatevMapping, Property } from '@/types';
import { uid } from './id';

/**
 * F-042 DATEV-Export — Buchungsstapel im DATEV-CSV-Format (vereinfacht).
 * Realer DATEV-Standard hat einen ausführlichen Header — wir liefern eine
 * pragmatische Version, die in DATEV Unternehmen Online importiert werden kann.
 */

const DEFAULT_INCOME_ACCOUNT = '8400'; // Erlöse
const DEFAULT_EXPENSE_ACCOUNT = '4900'; // Sonstige betriebliche Aufwendungen
const DEFAULT_CASH_ACCOUNT = '1200'; // Bank

interface ExportInput {
  bookings: Booking[];
  properties: Property[];
  mapping: DatevMapping[];
  fromDate: string;
  toDate: string;
}

export async function exportDatev(input: ExportInput): Promise<string> {
  const { bookings, properties, mapping, fromDate, toDate } = input;
  const filtered = bookings.filter((b) => b.date >= fromDate && b.date <= toDate);

  const accountFor = (categoryId: string | null, type: 'income' | 'expense'): string => {
    if (categoryId) {
      const m = mapping.find((x) => x.categoryId === categoryId);
      if (m) return m.account;
    }
    return type === 'income' ? DEFAULT_INCOME_ACCOUNT : DEFAULT_EXPENSE_ACCOUNT;
  };

  const propertyById = new Map(properties.map((p) => [p.id, p.name]));

  // Spalten gemäß vereinfachter DATEV-Buchungsstapel-Konvention
  const lines: string[] = [
    '"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen";"Konto";"Gegenkonto (ohne BU-Schlüssel)";"Belegdatum";"Belegfeld 1";"Buchungstext";"Kostenstelle1"',
  ];

  for (const b of filtered) {
    const account = accountFor(b.categoryId, b.type);
    const counterAccount = DEFAULT_CASH_ACCOUNT;
    // Bei Einnahme: Soll Bank, Haben Erlöskonto → S
    // Bei Ausgabe: Soll Aufwandskonto, Haben Bank → S
    const sollHaben = 'S';
    const konto = b.type === 'income' ? counterAccount : account;
    const gegenkonto = b.type === 'income' ? account : counterAccount;

    const date = b.date.slice(5).replace('-', '') + b.date.slice(2, 4); // DDMMJJ — DATEV nutzt TT/MM
    const text = (b.counterparty ?? b.note ?? '').replace(/"/g, '""').slice(0, 60);
    const property = b.propertyId ? propertyById.get(b.propertyId) : '';
    const cell = (v: string | number) => `"${v}"`;
    lines.push(
      [
        cell(b.amount.toFixed(2).replace('.', ',')),
        cell(sollHaben),
        cell(konto),
        cell(gegenkonto),
        cell(date),
        cell(b.id.slice(-10)),
        cell(text),
        cell(property ?? ''),
      ].join(';'),
    );
  }

  const csv = lines.join('\r\n');
  const path = `${FileSystem.documentDirectory}${uid('datev')}.csv`;
  await FileSystem.writeAsStringAsync(path, csv);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
  return path;
}
