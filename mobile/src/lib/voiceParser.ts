import { Booking, Category, Property } from '@/types';

/**
 * F-047 Sprachdiktat — parst transkribierte Sprache in einen Buchungs-Draft.
 *
 * Beispiele:
 *  "120 Euro Tankstelle Aral"          → expense, 120 EUR, Tankstelle, Aral
 *  "Miete 850 Euro Müller"             → income, 850 EUR, Miete, Müller
 *  "Reparatur 89,50 Heizung Südstraße" → expense, 89.50 EUR, Reparatur, "Heizung", Property "Südstraße"
 *
 * Heuristik (DE-zentriert):
 * - „Einnahme/eingang/erhalten/miete/lohn/gehalt" → type=income
 * - sonst type=expense
 * - erste Zahl = Betrag (Komma oder Punkt erlaubt)
 * - Kategorie-Schlüsselwörter (vendor → category)
 * - Property-Match per Substring auf bekannte Property-Namen
 */

const INCOME_TRIGGERS = [
  'miete','mieteinnahme','einnahme','eingang','erhalten','gehalt','lohn','bonus','rückzahlung','gutschrift',
];

const CATEGORY_HINTS: Array<{ keywords: string[]; categoryId: string }> = [
  { keywords: ['miete','mieteinnahme'],           categoryId: 'cat-miete' },
  { keywords: ['nebenkosten','nk'],               categoryId: 'cat-nk' },
  { keywords: ['strom','stadtwerk','energie'],    categoryId: 'cat-strom' },
  { keywords: ['wasser','frischwasser'],          categoryId: 'cat-wasser' },
  { keywords: ['gas','heizung','heizöl','heizoel'],categoryId: 'cat-gas' },
  { keywords: ['hausgeld','hausverwaltung'],      categoryId: 'cat-hausgeld' },
  { keywords: ['internet','telefon','mobilfunk','telekom','vodafone','o2'], categoryId: 'cat-internet' },
  { keywords: ['versicherung','allianz','huk','axa','ergo'], categoryId: 'cat-versicherung' },
  { keywords: ['gez','rundfunk','beitragsservice'], categoryId: 'cat-gez' },
  { keywords: ['tankstelle','tanken','aral','shell','jet','esso','total'], categoryId: 'cat-sonstiges' },
  { keywords: ['reparatur','sanitär','elektrik','schreiner','installateur','klempner','handwerker'], categoryId: 'cat-reparatur' },
  { keywords: ['rewe','edeka','lidl','aldi','penny','kaufland','einkauf','supermarkt'], categoryId: 'cat-einkauf' },
  { keywords: ['restaurant','pizza','döner','imbiss','café','cafe','bar'], categoryId: 'cat-restaurant' },
  { keywords: ['grundsteuer','finanzamt'],        categoryId: 'cat-grundsteuer' },
  { keywords: ['kredit','zinsen','darlehen','tilgung','bank'], categoryId: 'cat-kredit' },
];

const NUMBER_RE = /([+-]?\s*\d{1,5}(?:[.,]\d{1,2})?)/;

export interface VoiceDraft {
  type: Booking['type'];
  amount: number | null;
  counterparty: string;
  categoryId: string | null;
  propertyId: string | null;
  raw: string;
  confidence: number; // 0..1
}

export function parseVoice(input: string, props: Property[], cats: Category[]): VoiceDraft {
  const raw = (input || '').trim();
  const lower = raw.toLowerCase();

  // Type bestimmen
  const isIncome = INCOME_TRIGGERS.some((t) => lower.includes(t));
  const type: Booking['type'] = isIncome ? 'income' : 'expense';

  // Betrag
  let amount: number | null = null;
  const m = lower.match(NUMBER_RE);
  if (m) {
    const n = Number(m[1].replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(n)) amount = n;
  }

  // Kategorie
  let categoryId: string | null = null;
  for (const hint of CATEGORY_HINTS) {
    if (hint.keywords.some((k) => lower.includes(k))) {
      // Nur zuweisen, wenn die Kategorie wirklich existiert
      if (cats.some((c) => c.id === hint.categoryId)) {
        categoryId = hint.categoryId;
        break;
      }
    }
  }

  // Objekt
  let propertyId: string | null = null;
  for (const p of props) {
    const name = (p.name || '').toLowerCase();
    if (name.length >= 3 && lower.includes(name)) {
      propertyId = p.id;
      break;
    }
  }

  // Counterparty: erste „große" Wortgruppe nach der Zahl, ohne Trigger-Wörter
  let counterparty = '';
  const wordsAfterAmount = m
    ? raw.slice((m.index ?? 0) + m[0].length).trim().replace(/^euro\b\s*/i, '')
    : raw;
  const cleaned = wordsAfterAmount
    .replace(/\b(euro|eur|€)\b/gi, '')
    .replace(/[.,;:]/g, '')
    .trim();
  if (cleaned) {
    const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
    counterparty = tokens.slice(0, 4).join(' ');
  }

  // Confidence-Score
  let confidence = 0;
  if (amount !== null) confidence += 0.4;
  if (categoryId) confidence += 0.3;
  if (counterparty) confidence += 0.2;
  if (propertyId) confidence += 0.1;

  return { type, amount, counterparty, categoryId, propertyId, raw, confidence };
}
