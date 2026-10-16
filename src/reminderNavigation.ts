import { dateFromDay, localDay } from './schedule.ts';
export type ReminderDestination = { taskId?: string; planId?: string; day?: string; intent: 'open' | 'focus' };
export function reminderDestination(hash: string): ReminderDestination | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('from') !== 'reminder') return null;
  const taskId = params.get('task') || undefined;
  const planId = params.get('plan') || undefined;
  const day = params.get('day') || undefined;
  if (
    (!taskId && !planId) ||
    (planId && !day) ||
    (taskId?.length ?? 0) > 120 ||
    (planId?.length ?? 0) > 120 ||
    (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || localDay(dateFromDay(day)) !== day))
  )
    return null;
  return { taskId, planId, day, intent: params.get('intent') === 'focus' ? 'focus' : 'open' };
}

export function canMaterializeReminder(
  plan: import('./schedule').WeeklyPlan | undefined,
  day: string | undefined,
  now: Date,
): boolean {
  if (!plan || !day) return false;
  const date = dateFromDay(day);
  const yesterday = dateFromDay(localDay(now));
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    (day === localDay(now) || day === localDay(yesterday)) &&
    localDay(date) === day &&
    day >= plan.startsOn &&
    (!plan.endsOn || day <= plan.endsOn) &&
    plan.weekdays.includes(date.getDay()) &&
    !(plan.generatedDates ?? []).includes(day)
  );
}
