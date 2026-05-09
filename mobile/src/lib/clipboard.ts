/**
 * F-025: Clipboard-Erkennung — extrahiert Betrag oder IBAN aus Zwischenablage.
 */

const AMOUNT_RE = /(-?\s*\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})\s*(?:€|EUR)?/;
const IBAN_RE = /\b([A-Z]{2}\d{2}(?:\s?\d{4}){3,7}\d{0,4})\b/;

export interface ClipboardHint {
  amount?: number;
  iban?: string;
  raw: string;
}

export function parseClipboard(raw: string | null | undefined): ClipboardHint | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hint: ClipboardHint = { raw: trimmed };

  const amountMatch = trimmed.match(AMOUNT_RE);
  if (amountMatch) {
    const cleaned = amountMatch[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const value = Number(cleaned);
    if (Number.isFinite(value)) hint.amount = value;
  }

  const ibanMatch = trimmed.toUpperCase().match(IBAN_RE);
  if (ibanMatch) {
    hint.iban = ibanMatch[1].replace(/\s/g, '');
  }

  if (hint.amount === undefined && hint.iban === undefined) return null;
  return hint;
}
