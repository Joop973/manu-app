import { Booking, Category, Craftsman, DocumentEntry, Property, Receipt, Tenant } from '@/types';

export type SearchHitKind =
  | 'booking'
  | 'property'
  | 'tenant'
  | 'craftsman'
  | 'document'
  | 'receipt';

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle?: string;
  trailing?: string;
}

interface Indexable {
  bookings: Booking[];
  properties: Property[];
  tenants: Tenant[];
  craftsmen: Craftsman[];
  documents: DocumentEntry[];
  receipts: Receipt[];
  categories: Category[];
}

/**
 * F-008: Globale Suche — schlichte case-insensitive Substring-Suche über alles.
 */
export function searchAll(query: string, data: Indexable): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  const matches = (...parts: (string | undefined)[]) =>
    parts.some((p) => p && p.toLowerCase().includes(q));

  const propertyById = new Map(data.properties.map((p) => [p.id, p.name]));
  const categoryById = new Map(data.categories.map((c) => [c.id, `${c.emoji} ${c.label}`]));

  for (const b of data.bookings) {
    const cat = b.categoryId ? categoryById.get(b.categoryId) : '';
    const prop = b.propertyId ? propertyById.get(b.propertyId) : '';
    if (matches(b.counterparty, b.note, cat, prop, String(b.amount))) {
      hits.push({
        kind: 'booking',
        id: b.id,
        title: b.counterparty || cat || `${b.amount.toFixed(2)} €`,
        subtitle: `${b.date}${prop ? ' · ' + prop : ''}`,
        trailing: `${b.type === 'income' ? '+' : '−'}${b.amount.toFixed(2)} €`,
      });
    }
  }

  for (const p of data.properties) {
    if (matches(p.name, p.address, p.notes, p.description)) {
      hits.push({ kind: 'property', id: p.id, title: p.name, subtitle: p.address });
    }
  }

  for (const t of data.tenants) {
    if (matches(t.name, t.email, t.phone, t.notes, t.unit)) {
      hits.push({
        kind: 'tenant',
        id: t.id,
        title: t.name,
        subtitle: t.propertyId ? propertyById.get(t.propertyId) : undefined,
      });
    }
  }

  for (const c of data.craftsmen) {
    if (matches(c.name, c.trade, c.phone, c.email, c.website, c.notes)) {
      hits.push({ kind: 'craftsman', id: c.id, title: c.name, subtitle: c.trade });
    }
  }

  for (const d of data.documents) {
    if (matches(d.filename, d.notes, d.category)) {
      hits.push({ kind: 'document', id: d.id, title: d.filename, subtitle: d.category });
    }
  }

  for (const r of data.receipts) {
    if (matches(r.filename, r.hint?.counterparty, r.extractedText)) {
      hits.push({
        kind: 'receipt',
        id: r.id,
        title: r.filename,
        subtitle: r.hint?.counterparty || r.kind,
      });
    }
  }

  return hits.slice(0, 50);
}
