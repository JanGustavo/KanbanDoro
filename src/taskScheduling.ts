import type { Data, Task } from './main';
import { dateFromDay, localDay, materializeToday, weekEnd, type WeeklyPlan } from './schedule.ts';

export type ScheduleEdit = {
  mode: 'once' | 'selected-days' | 'weekly';
  startDate: string;
  weekdays: number[];
  reminderTime: string;
};

export function saveTaskSchedule(
  old: Data,
  taskId: string,
  choice: ScheduleEdit,
  now: Date,
  makeId: () => string,
  create: (plan: WeeklyPlan, day: string) => Task,
): Data {
  const current = old.tasks.find(item => item.id === taskId);
  if (!current) return old;
  const previous = old.weeklyPlans.find(plan => plan.id === current.planId);
  const plans = old.weeklyPlans.filter(plan => plan.id !== previous?.id);
  if (choice.mode === 'once') {
    return {
      ...old,
      weeklyPlans: plans,
      tasks: old.tasks.map(item =>
        item.id === current.id
          ? {
              ...item,
              planId: undefined,
              occurrenceDate: undefined,
              reminderDate: choice.reminderTime ? choice.startDate : undefined,
              reminderTime: choice.reminderTime || undefined,
            }
          : item,
      ),
    };
  }
  const day = localDay(now);
  const seedDay = previous
    ? current.occurrenceDate
    : choice.startDate <= day &&
        (choice.mode !== 'selected-days' || day <= weekEnd(dateFromDay(choice.startDate))) &&
        choice.weekdays.includes(now.getDay())
      ? day
      : undefined;
  const plan: WeeklyPlan = {
    id: previous?.id ?? makeId(),
    name: current.name,
    description: current.description,
    difficulty: current.difficulty,
    skill: current.skill,
    estimate: current.estimate,
    sliceNames: current.slices.map(slice => slice.name),
    attachments: current.attachments,
    weekdays: choice.weekdays,
    startsOn: choice.startDate,
    reminderTime: choice.reminderTime || undefined,
    endsOn: choice.mode === 'selected-days' ? weekEnd(dateFromDay(choice.startDate)) : undefined,
    generatedDates: [...new Set([...(previous?.generatedDates ?? []), ...(seedDay ? [seedDay] : [])])],
  };
  const tasks = old.tasks.map(item =>
    item.id === current.id
      ? {
          ...item,
          planId: plan.id,
          occurrenceDate: seedDay,
          reminderDate: choice.reminderTime ? seedDay : undefined,
          reminderTime: choice.reminderTime || undefined,
        }
      : item,
  );
  const generated = materializeToday(tasks, [...plans, plan], now, create);
  return { ...old, tasks: generated.tasks, weeklyPlans: generated.plans };
}
