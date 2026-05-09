import { ReceiptHint } from '@/types';

/**
 * F-028: Akribische KI-Analyse — lokal, regelbasiert.
 * Arbeitet auf einem zusammengeführten Korpus aus Dateinamen + extrahiertem Text.
 * Liefert immer einen Hint zurück; Felder, die nicht erkannt wurden, fehlen einfach.
 */

const TOTAL_LABELS = [
  'gesamtbetrag',
  'gesamtsumme',
  'endbetrag',
  'rechnungsbetrag',
  'zu zahlen',
  'summe',
  'betrag',
];

const DATE_LABELS = ['rechnungsdatum', 'datum', 'belegdatum', 'fällig', 'faellig', 'falligkeit'];

const VENDOR_KEYWORDS: Array<{ name: string; categoryId: string; aliases: string[] }> = [
  { name: 'Telekom', categoryId: 'cat-internet', aliases: ['telekom', 'magenta'] },
  { name: 'Vodafone', categoryId: 'cat-internet', aliases: ['vodafone'] },
  { name: '1&1', categoryId: 'cat-internet', aliases: ['1und1', '1 und 1', '1&1'] },
  { name: 'GEZ / Rundfunk', categoryId: 'cat-gez', aliases: ['rundfunkbeitrag', 'gez', 'beitragsservice'] },
  { name: 'Stadtwerke', categoryId: 'cat-strom', aliases: ['stadtwerke', 'kwh'] },
  { name: 'E.ON', categoryId: 'cat-strom', aliases: ['e.on', 'eon'] },
  { name: 'Vattenfall', categoryId: 'cat-strom', aliases: ['vattenfall'] },
  { name: 'Allianz', categoryId: 'cat-versicherung', aliases: ['allianz'] },
  { name: 'HUK', categoryId: 'cat-versicherung', aliases: ['huk', 'huk-coburg'] },
  { name: 'AXA', categoryId: 'cat-versicherung', aliases: ['axa'] },
  { name: 'ERGO', categoryId: 'cat-versicherung', aliases: ['ergo'] },
  { name: 'Finanzamt', categoryId: 'cat-steuer', aliases: ['finanzamt'] },
  { name: 'Hausverwaltung', categoryId: 'cat-hausgeld', aliases: ['hausgeld', 'hausverwaltung', 'wohnungseigentümer'] },
  { name: 'Bank', categoryId: 'cat-kredit', aliases: ['kreditrate', 'darlehen', 'tilgung'] },
];

const COMPANY_SUFFIX = /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9.&-]+(?:\s[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9.&-]+){0,3})\s+(?:GmbH|AG|KG|OHG|e\.V\.|UG)\b/;

const AMOUNT_AT_LABEL = /([+-]?\s*\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})\s*(?:€|EUR)?/g;

const DATE_DE = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/;
const DATE_ISO = /(\d{4})-(\d{2})-(\d{2})/;
const MONTH_DE: Record<string, string> = {
  januar: '01', jan: '01',
  februar: '02', feb: '02',
  märz: '03', maerz: '03', mar: '03', mrz: '03',
  april: '04', apr: '04',
  mai: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  oktober: '10', okt: '10',
  november: '11', nov: '11',
  dezember: '12', dez: '12',
};

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

function normalizeDate(parts: { d: string; m: string; y: string }): string | null {
  let { d, m, y } = parts;
  if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
  if (Number(d) < 1 || Number(d) > 31) return null;
  if (Number(m) < 1 || Number(m) > 12) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function extractAmount(corpus: string): number | undefined {
  const lower = corpus.toLowerCase();
  // 1) Versuch: nahe einem Total-Label
  for (const label of TOTAL_LABELS) {
    const idx = lower.indexOf(label);
    if (idx === -1) continue;
    const window = corpus.slice(idx, idx + 100);
    const match = window.match(AMOUNT_AT_LABEL);
    if (match && match.length > 0) {
      const value = parseAmount(match[0]);
      if (value !== null && value > 0) return value;
    }
  }
  // 2) Fallback: höchster Betrag im Dokument (oft der Endbetrag)
  let max = -Infinity;
  const matches = corpus.match(AMOUNT_AT_LABEL);
  if (matches) {
    for (const m of matches) {
      const v = parseAmount(m);
      if (v !== null && v > max) max = v;
    }
  }
  return max > 0 ? max : undefined;
}

function extractDate(corpus: string): string | undefined {
  const lower = corpus.toLowerCase();
  for (const label of DATE_LABELS) {
    const idx = lower.indexOf(label);
    if (idx === -1) continue;
    const window = corpus.slice(idx, idx + 60);
    const isoMatch = window.match(DATE_ISO);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const deMatch = window.match(DATE_DE);
    if (deMatch) {
      const norm = normalizeDate({ d: deMatch[1], m: deMatch[2], y: deMatch[3] });
      if (norm) return norm;
    }
  }
  // Fallback: irgendein Datum im Text
  const isoMatch = corpus.match(DATE_ISO);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const deMatch = corpus.match(DATE_DE);
  if (deMatch) {
    const norm = normalizeDate({ d: deMatch[1], m: deMatch[2], y: deMatch[3] });
    if (norm) return norm;
  }
  // Monatsname + Jahr im Dateinamen (z.B. "Stadtwerke_Mai_2026.pdf")
  const monthYear = corpus.toLowerCase().match(/\b(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mar|mrz|apr|jun|jul|aug|sep|sept|okt|nov|dez)[\s_.-]+(\d{4})\b/);
  if (monthYear && MONTH_DE[monthYear[1]]) {
    return `${monthYear[2]}-${MONTH_DE[monthYear[1]]}-01`;
  }
  return undefined;
}

function extractVendor(corpus: string): { name?: string; categoryId?: string; matchedKeyword?: string } {
  const lower = corpus.toLowerCase();
  for (const vendor of VENDOR_KEYWORDS) {
    for (const alias of vendor.aliases) {
      if (lower.includes(alias)) {
        return { name: vendor.name, categoryId: vendor.categoryId, matchedKeyword: alias };
      }
    }
  }
  const company = corpus.match(COMPANY_SUFFIX);
  if (company) return { name: company[0].trim() };
  return {};
}

export function parseReceipt(input: { filename: string; text?: string }): ReceiptHint {
  const filename = input.filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const text = input.text ?? '';
  const corpus = `${filename}\n${text}`;

  const amount = extractAmount(corpus);
  const date = extractDate(corpus);
  const vendor = extractVendor(corpus);

  let confidence = 0;
  if (amount !== undefined) confidence += 0.4;
  if (date !== undefined) confidence += 0.3;
  if (vendor.name) confidence += 0.3;

  return {
    amount,
    date,
    counterparty: vendor.name,
    categoryId: vendor.categoryId,
    confidence,
    parsedFrom: text ? 'text' : 'filename',
  };
}

/**
 * EPC-QR-Code-Parser (F-031): "Girocode" deutscher Rechnungen.
 * Format: BCD\n002\n1\nSCT\nBIC\nNAME\nIBAN\nEUR{amount}\n...
 */
export function parseEpcQr(qr: string): { amount?: number; iban?: string; counterparty?: string } | null {
  if (!qr.startsWith('BCD')) return null;
  const lines = qr.split(/\r?\n/);
  if (lines.length < 7) return null;
  const result: { amount?: number; iban?: string; counterparty?: string } = {};
  result.counterparty = lines[5]?.trim() || undefined;
  result.iban = lines[6]?.trim() || undefined;
  const amountLine = lines[7]?.trim();
  if (amountLine?.startsWith('EUR')) {
    const num = Number(amountLine.slice(3).replace(',', '.'));
    if (Number.isFinite(num)) result.amount = num;
  }
  return result;
}
