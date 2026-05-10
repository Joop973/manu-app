import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Booking, Property, Tenant } from '@/types';
import { formatEuro } from './calc';

/**
 * F-040 NK-Abrechnungs-Generator — pro Objekt + Jahr alle umlagefähigen
 * Kosten zusammenrechnen, auf einen Mieter umlegen (Verteilerschlüssel
 * konfigurierbar), gegen Vorauszahlungen rechnen.
 */

export type Distribution = 'area' | 'persons' | 'equal';

/** Default-Kategorie-Liste, die in der NK-Abrechnung umlagefähig ist. */
export const NK_CATEGORY_IDS = ['cat-strom', 'cat-wasser', 'cat-hausgeld', 'cat-gez', 'cat-reinigung', 'cat-garten'];

export interface NkLineItem {
  categoryId: string;
  label: string;
  totalCost: number;
  distribution: Distribution;
  tenantShare: number;
}

export interface NkResult {
  property: Property;
  tenant: Tenant;
  year: number;
  fromDate: string;
  toDate: string;
  items: NkLineItem[];
  totalAttributable: number;
  prepaymentSum: number;
  difference: number; // positiv = Mieter zahlt nach, negativ = Guthaben
}

interface ComputeInput {
  property: Property;
  tenant: Tenant;
  bookings: Booking[];
  year: number;
  /** Optional: pro Kategorie der Verteilerschlüssel. */
  distributionByCategory?: Partial<Record<string, Distribution>>;
  /** Wohnflächen aller Mieter im Objekt zusammen, falls keiner gesetzt. */
  totalLivingAreaFallback?: number;
  /** Personen aller Mieter im Objekt zusammen. */
  totalPersonsFallback?: number;
  totalUnits?: number;
}

export function computeNkAbrechnung(input: ComputeInput): NkResult {
  const { property, tenant, bookings, year } = input;
  const fromDate = `${year}-01-01`;
  const toDate = `${year}-12-31`;
  const ofPeriod = bookings.filter(
    (b) =>
      b.propertyId === property.id &&
      b.type === 'expense' &&
      b.categoryId &&
      NK_CATEGORY_IDS.includes(b.categoryId) &&
      b.date >= fromDate &&
      b.date <= toDate,
  );

  const items: NkLineItem[] = NK_CATEGORY_IDS.map((catId) => {
    const total = ofPeriod
      .filter((b) => b.categoryId === catId)
      .reduce((s, b) => s + b.amount, 0);
    const distribution: Distribution = input.distributionByCategory?.[catId] ?? 'area';
    return {
      categoryId: catId,
      label: catId.replace('cat-', ''),
      totalCost: total,
      distribution,
      tenantShare: 0,
    };
  }).filter((i) => i.totalCost > 0);

  const tenantArea = tenant.livingArea ?? 0;
  const totalArea = property.totalLivingArea ?? input.totalLivingAreaFallback ?? Math.max(1, tenantArea);
  const tenantPersons = tenant.personCount ?? 1;
  const totalPersons = input.totalPersonsFallback ?? Math.max(1, tenantPersons);
  const totalUnits = input.totalUnits ?? 1;

  for (const item of items) {
    if (item.distribution === 'area' && totalArea > 0 && tenantArea > 0) {
      item.tenantShare = (item.totalCost * tenantArea) / totalArea;
    } else if (item.distribution === 'persons' && totalPersons > 0) {
      item.tenantShare = (item.totalCost * tenantPersons) / totalPersons;
    } else {
      item.tenantShare = item.totalCost / Math.max(1, totalUnits);
    }
  }

  const totalAttributable = items.reduce((s, i) => s + i.tenantShare, 0);

  // Vorauszahlungen: Differenz Warm − Kalt × 12, falls vorhanden
  const monthlyPrepay = (tenant.rentWarm ?? 0) - (tenant.rentCold ?? 0);
  const prepaymentSum = Math.max(0, monthlyPrepay) * 12;
  const difference = totalAttributable - prepaymentSum;

  return {
    property,
    tenant,
    year,
    fromDate,
    toDate,
    items,
    totalAttributable,
    prepaymentSum,
    difference,
  };
}

export async function exportNkPdf(result: NkResult): Promise<string> {
  const itemRows = result.items
    .map(
      (i) => `<tr>
        <td>${i.label}</td>
        <td>${formatEuro(i.totalCost)}</td>
        <td>${i.distribution === 'area' ? 'Wohnfläche' : i.distribution === 'persons' ? 'Personen' : 'Einheiten'}</td>
        <td>${formatEuro(i.tenantShare)}</td>
      </tr>`,
    )
    .join('');

  const settledColor = result.difference > 0 ? '#C9302C' : '#2D8A4E';
  const settledLabel = result.difference > 0 ? 'Nachzahlung' : 'Guthaben';

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, sans-serif; padding: 32px; color: #1a1a1a; }
      h1 { color: #8a6d1d; }
      h2 { color: #8a6d1d; margin-top: 22px; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
      th, td { border-bottom: 1px solid #e0d59f; padding: 5px 8px; text-align: left; }
      th { background: #f6efce; }
      .total { font-weight: bold; background: #fafaf6; }
    </style></head>
    <body>
      <h1>Nebenkostenabrechnung ${result.year}</h1>
      <p><b>Objekt:</b> ${result.property.name} (${result.property.address ?? ''})</p>
      <p><b>Mieter:</b> ${result.tenant.name}${result.tenant.unit ? ` (${result.tenant.unit})` : ''}</p>
      <p><b>Abrechnungszeitraum:</b> ${result.fromDate} bis ${result.toDate}</p>
      ${result.tenant.livingArea ? `<p><b>Wohnfläche Mieter:</b> ${result.tenant.livingArea} m²</p>` : ''}

      <h2>Umlagefähige Kosten</h2>
      <table>
        <thead><tr><th>Position</th><th>Gesamt</th><th>Schlüssel</th><th>Mieter-Anteil</th></tr></thead>
        <tbody>
          ${itemRows || '<tr><td colspan="4"><i>Keine umlagefähigen Kosten erfasst</i></td></tr>'}
          <tr class="total"><td>Summe</td><td></td><td></td><td>${formatEuro(result.totalAttributable)}</td></tr>
        </tbody>
      </table>

      <h2>Abrechnung</h2>
      <table>
        <tbody>
          <tr><td>Anteil Mieter (gesamt)</td><td>${formatEuro(result.totalAttributable)}</td></tr>
          <tr><td>Geleistete Vorauszahlungen</td><td>${formatEuro(result.prepaymentSum)}</td></tr>
          <tr class="total" style="color: ${settledColor};">
            <td>${settledLabel}</td>
            <td>${formatEuro(Math.abs(result.difference))}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top: 24px; font-size: 10px; color: #888;">
        Manu Imperial Finance · Hilfsdokument — keine rechtsverbindliche
        Abrechnung. Bitte Verteilerschlüssel und Mietvertrag prüfen.
      </p>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}
