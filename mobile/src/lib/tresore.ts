import { Booking, Category } from '@/types';
import { FIXED_COST_CATEGORY_IDS } from '@/db/categories';

/**
 * F-032: Miet-Tresor — gruppiert Mieteinnahmen nach Mieter (counterparty).
 */
export interface RentBucket {
  counterparty: string;
  count: number;
  sum: number;
  bookings: Booking[];
  hadLastMonth: boolean;
  hasThisMonth: boolean;
}

export function buildRentTresor(bookings: Booking[], monthIso: string, lastMonthIso: string): RentBucket[] {
  const map = new Map<string, RentBucket>();
  const isRentCategory = (b: Booking) => b.categoryId === 'cat-miete';
  for (const b of bookings) {
    if (b.type !== 'income' || !isRentCategory(b)) continue;
    const key = (b.counterparty ?? '— ohne Name').trim();
    const bucket = map.get(key) ?? {
      counterparty: key,
      count: 0,
      sum: 0,
      bookings: [],
      hadLastMonth: false,
      hasThisMonth: false,
    };
    bucket.bookings.push(b);
    if (b.date.startsWith(monthIso)) {
      bucket.count += 1;
      bucket.sum += b.amount;
      bucket.hasThisMonth = true;
    }
    if (b.date.startsWith(lastMonthIso)) bucket.hadLastMonth = true;
    map.set(key, bucket);
  }
  return [...map.values()].sort((a, b) => b.sum - a.sum);
}

/**
 * F-033: Fixkosten-Tresor — Ausgaben in Fixkosten-Kategorien gruppiert.
 */
export interface FixedBucket {
  categoryId: string;
  category?: Category;
  count: number;
  sum: number;
  prevSum: number;
  bookings: Booking[];
}

export function buildFixedTresor(
  bookings: Booking[],
  categories: Category[],
  monthIso: string,
  prevMonthIso: string,
): FixedBucket[] {
  const map = new Map<string, FixedBucket>();
  for (const b of bookings) {
    if (b.type !== 'expense') continue;
    if (!b.categoryId) continue;
    if (!FIXED_COST_CATEGORY_IDS.has(b.categoryId)) continue;
    const bucket =
      map.get(b.categoryId) ?? {
        categoryId: b.categoryId,
        category: categories.find((c) => c.id === b.categoryId),
        count: 0,
        sum: 0,
        prevSum: 0,
        bookings: [],
      };
    if (b.date.startsWith(monthIso)) {
      bucket.count += 1;
      bucket.sum += b.amount;
      bucket.bookings.push(b);
    } else if (b.date.startsWith(prevMonthIso)) {
      bucket.prevSum += b.amount;
    }
    map.set(b.categoryId, bucket);
  }
  return [...map.values()].sort((a, b) => b.sum - a.sum);
}
