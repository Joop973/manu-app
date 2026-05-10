import { Booking, BookingType } from '@/types';
import { uid } from './id';

/**
 * F-114 CSV-Import — versteht Bank-Exporte von DKB, Sparkasse, ING, N26
 * und Comdirect (heuristische Spalten-Erkennung).
 */

export interface ImportPreview {
  format: string;
  rows: Booking[];
  errors: string[];
}

const DELIMITERS = [';', ',', '\t'];

function detectDelimiter(line: string): string {
  let best = ',';
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const c = line.split(d).length;
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // DE: DD.MM.YYYY oder DD.MM.YY
  const m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  // US: MM/DD/YYYY
  const m2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m2) {
    let y = m2[3];
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    return `${y}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  }
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/€/g, '').replace(/EUR/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((c) => c.trim());
}

function findColumn(headers: string[], patterns: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const p of patterns) {
    const idx = lower.findIndex((h) => h.includes(p));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseCsv(rawText: string, defaultPropertyId: string | null = null): ImportPreview {
  const errors: string[] = [];
  if (!rawText.trim()) return { format: 'leer', rows: [], errors: ['Leere Datei'] };

  // Header-Suchen: einige Banken haben Vorspann (Konto-Header). Wir suchen die erste Zeile, in der "Datum" oder "Buchungstag" auftaucht.
  const lines = rawText.split(/\r?\n/).filter((l) => l.length > 0);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, lines.length); i += 1) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('datum') || lower.includes('buchungstag') || lower.includes('value date') || lower.includes('booking')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 0;

  const delimiter = detectDelimiter(lines[headerIdx]);
  const headers = splitCsvLine(lines[headerIdx], delimiter);

  const dateIdx = findColumn(headers, ['buchungstag', 'datum', 'value date', 'booking', 'date']);
  const counterpartyIdx = findColumn(headers, ['empfänger', 'auftraggeber', 'beguenstigter', 'name', 'payee', 'partner']);
  const purposeIdx = findColumn(headers, ['verwendungszweck', 'buchungstext', 'reference', 'description', 'memo']);
  const amountIdx = findColumn(headers, ['betrag', 'amount', 'umsatz', 'wert']);

  if (dateIdx === -1 || amountIdx === -1) {
    return {
      format: 'unbekannt',
      rows: [],
      errors: ['Konnte Spalten "Datum" oder "Betrag" nicht finden. Bitte CSV-Format prüfen.'],
    };
  }

  const rows: Booking[] = [];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length <= 1) continue;
    const dateRaw = cols[dateIdx];
    const amountRaw = cols[amountIdx];
    const date = parseDate(dateRaw);
    const amount = parseAmount(amountRaw);
    if (!date || amount === null) {
      errors.push(`Zeile ${i + 1} übersprungen: Datum/Betrag unlesbar`);
      continue;
    }
    const type: BookingType = amount < 0 ? 'expense' : 'income';
    const counterparty = counterpartyIdx >= 0 ? cols[counterpartyIdx] : undefined;
    const note = purposeIdx >= 0 ? cols[purposeIdx] : undefined;
    rows.push({
      id: uid('imp'),
      type,
      amount: Math.abs(amount),
      date,
      propertyId: defaultPropertyId,
      categoryId: null,
      counterparty: counterparty?.trim() || undefined,
      note: note?.trim() || undefined,
      recurrence: 'none',
      createdAt: new Date().toISOString(),
    });
  }

  const format = guessFormat(rawText);
  return { format, rows, errors };
}

function guessFormat(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('dkb')) return 'DKB';
  if (lower.includes('sparkasse')) return 'Sparkasse';
  if (lower.includes('comdirect')) return 'Comdirect';
  if (lower.includes('n26')) return 'N26';
  if (lower.includes('ing-diba') || lower.includes('ing diba')) return 'ING';
  return 'generisch';
}
