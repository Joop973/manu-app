import { AchievementState, Booking, Goal, Subscription } from '@/types';

/**
 * F-118 Achievements / Streaks — passt zum Casino-Theme.
 * Berechnet aus dem aktuellen Stand neu, was schon "verdient" ist.
 */

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-booking', emoji: '🎰', title: 'Erste Goldmünze', description: '1 Buchung erfasst', unlocked: false },
  { id: 'tenth-booking', emoji: '🥇', title: 'Routinier', description: '10 Buchungen erfasst', unlocked: false },
  { id: 'hundred-booking', emoji: '🏆', title: 'Tresor-Meister', description: '100 Buchungen erfasst', unlocked: false },
  { id: 'streak-7', emoji: '🔥', title: '7-Tage-Streak', description: '7 Tage in Folge erfasst', unlocked: false },
  { id: 'streak-30', emoji: '🌟', title: '30-Tage-Streak', description: '30 Tage in Folge erfasst', unlocked: false },
  { id: 'first-property', emoji: '🏛️', title: 'Imperiums-Gründer', description: 'Erstes Objekt angelegt', unlocked: false },
  { id: 'first-tenant', emoji: '👑', title: 'Erster Vasall', description: 'Erster Mieter erfasst', unlocked: false },
  { id: 'first-goal', emoji: '🎯', title: 'Sparfuchs', description: 'Erstes Sparziel angelegt', unlocked: false },
  { id: 'goal-achieved', emoji: '💎', title: 'Goldener Imperator', description: 'Sparziel erreicht', unlocked: false },
  { id: 'sub-detector', emoji: '🔍', title: 'Detektiv', description: 'Erstes Abo erkannt + verwaltet', unlocked: false },
  { id: 'profitable-month', emoji: '📈', title: 'Royale Marge', description: 'Ein Monat mit >40% Profitmarge', unlocked: false },
];

export function evaluateAchievements(input: {
  state: AchievementState;
  bookings: Booking[];
  hasProperty: boolean;
  hasTenant: boolean;
  goals: Goal[];
  subscriptions: Subscription[];
}): { ids: string[]; newlyUnlocked: string[] } {
  const { state, bookings, hasProperty, hasTenant, goals, subscriptions } = input;
  const earned = new Set(state.unlocked);
  const original = new Set(state.unlocked);

  if (bookings.length >= 1) earned.add('first-booking');
  if (bookings.length >= 10) earned.add('tenth-booking');
  if (bookings.length >= 100) earned.add('hundred-booking');
  if (state.streak >= 7) earned.add('streak-7');
  if (state.streak >= 30) earned.add('streak-30');
  if (hasProperty) earned.add('first-property');
  if (hasTenant) earned.add('first-tenant');
  if (goals.length > 0) earned.add('first-goal');
  if (goals.some((g) => g.saved >= g.target && g.target > 0)) earned.add('goal-achieved');
  if (subscriptions.length > 0) earned.add('sub-detector');

  const monthly = monthlyMargins(bookings);
  if (monthly.some((m) => m >= 0.4)) earned.add('profitable-month');

  const ids = [...earned];
  const newlyUnlocked = ids.filter((id) => !original.has(id));
  return { ids, newlyUnlocked };
}

function monthlyMargins(bookings: Booking[]): number[] {
  const map = new Map<string, { income: number; expense: number }>();
  for (const b of bookings) {
    const key = b.date.slice(0, 7);
    const slot = map.get(key) ?? { income: 0, expense: 0 };
    if (b.type === 'income') slot.income += b.amount;
    else slot.expense += b.amount;
    map.set(key, slot);
  }
  const out: number[] = [];
  for (const { income, expense } of map.values()) {
    if (income > 0) out.push((income - expense) / income);
  }
  return out;
}

/**
 * Streak-Update basierend auf dem heutigen Datum: war gestern eine Buchung
 * gemacht, +1; war gestern keine, reset auf 1 wenn heute eine; sonst keine.
 */
export function updateStreak(input: { state: AchievementState; today: string; bookingDates: string[] }): AchievementState {
  const { state, today, bookingDates } = input;
  if (!bookingDates.includes(today)) return state;
  if (state.lastActiveDate === today) return state;
  const yesterday = isoYesterday(today);
  const newStreak = state.lastActiveDate === yesterday ? state.streak + 1 : 1;
  return { ...state, streak: newStreak, lastActiveDate: today };
}

function isoYesterday(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
