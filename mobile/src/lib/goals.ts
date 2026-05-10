import { Goal } from '@/types';

/**
 * F-109 Savings Goals — Fortschrittsberechnung.
 */
export interface GoalProgress {
  goal: Goal;
  percent: number;
  remaining: number;
  daysLeft?: number;
  monthlyNeeded?: number;
  status: 'onTrack' | 'behind' | 'achieved' | 'noDeadline';
}

export function evaluateGoal(g: Goal, today: Date = new Date()): GoalProgress {
  const remaining = Math.max(0, g.target - g.saved);
  const percent = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
  if (remaining === 0) return { goal: g, percent: 1, remaining: 0, status: 'achieved' };
  if (!g.deadline) return { goal: g, percent, remaining, status: 'noDeadline' };
  const deadline = new Date(g.deadline);
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  if (daysLeft <= 0) return { goal: g, percent, remaining, daysLeft, status: 'behind' };
  const monthsLeft = Math.max(1, daysLeft / 30);
  const monthlyNeeded = remaining / monthsLeft;
  return {
    goal: g,
    percent,
    remaining,
    daysLeft,
    monthlyNeeded,
    status: percent >= 1 - daysLeft / 365 ? 'onTrack' : 'behind',
  };
}
