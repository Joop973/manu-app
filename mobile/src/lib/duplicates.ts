import { Booking } from '@/types';

/**
 * F-026: Duplikat-Warnung.
 * Erkennt eine Buchung als möglichen Duplikat, wenn am gleichen Datum
 * für das gleiche Objekt der gleiche Betrag bereits existiert.
 */
export function findPossibleDuplicate(
  candidate: Pick<Booking, 'amount' | 'date' | 'propertyId'>,
  existing: Booking[],
): Booking | undefined {
  return existing.find(
    (b) =>
      Math.abs(b.amount - candidate.amount) < 0.005 &&
      b.date === candidate.date &&
      b.propertyId === candidate.propertyId,
  );
}
