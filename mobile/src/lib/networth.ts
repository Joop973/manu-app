import { Asset, Liability } from '@/types';

/**
 * F-112 Net Worth = Aktiva − Passiva.
 * Liefert Aufschlüsselung pro Kategorie und einen Verlaufs-Datensatz aus
 * den jeweiligen `history`-Arrays (kombiniert).
 */
export interface NetWorthSnapshot {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetsByKind: Record<string, number>;
  liabilitiesByKind: Record<string, number>;
}

export function computeNetWorth(assets: Asset[], liabilities: Liability[]): NetWorthSnapshot {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const assetsByKind: Record<string, number> = {};
  for (const a of assets) {
    assetsByKind[a.kind] = (assetsByKind[a.kind] ?? 0) + a.value;
  }
  const liabilitiesByKind: Record<string, number> = {};
  for (const l of liabilities) {
    liabilitiesByKind[l.kind] = (liabilitiesByKind[l.kind] ?? 0) + l.balance;
  }
  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    assetsByKind,
    liabilitiesByKind,
  };
}

export interface NetWorthHistoryPoint {
  date: string;
  net: number;
}

export function buildNetWorthHistory(assets: Asset[], liabilities: Liability[]): NetWorthHistoryPoint[] {
  const dates = new Set<string>();
  for (const a of assets) for (const h of a.history) dates.add(h.date);
  for (const l of liabilities) for (const h of l.history) dates.add(h.date);
  const sorted = [...dates].sort();
  const points: NetWorthHistoryPoint[] = [];
  for (const date of sorted) {
    let assetTotal = 0;
    for (const a of assets) {
      const last = a.history.filter((h) => h.date <= date).pop();
      if (last) assetTotal += last.value;
    }
    let liabTotal = 0;
    for (const l of liabilities) {
      const last = l.history.filter((h) => h.date <= date).pop();
      if (last) liabTotal += last.balance;
    }
    points.push({ date, net: assetTotal - liabTotal });
  }
  return points;
}
