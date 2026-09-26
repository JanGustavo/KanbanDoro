export type WeeklyPlan = {
  id: string;
  name: string;
  estimate: number;
  weekdays: number[];
  startsOn: string;
  generatedDates: string[];
};

export type ViewMode = 'today' | 'week' | 'all' | 'archive';

export function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weekStart(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7);
  return localDay(monday);
}

export function materializeToday<T extends { planId?: string; occurrenceDate?: string }>(
  tasks: T[], plans: WeeklyPlan[], date: Date, create: (plan: WeeklyPlan, day: string) => T
): { tasks: T[]; plans: WeeklyPlan[] } {
  const day = localDay(date);
  let nextTasks = tasks;
  const nextPlans = plans.map(plan => {
    if (day < plan.startsOn || !plan.weekdays.includes(date.getDay()) || plan.generatedDates?.includes(day)) return plan;
    if (!nextTasks.some(task => task.planId === plan.id && task.occurrenceDate === day)) {
      nextTasks = [...nextTasks, create(plan, day)];
    }
    return { ...plan, generatedDates: [...(plan.generatedDates ?? []), day] };
  });
  return { tasks: nextTasks, plans: nextPlans };
}

export function isVisible<T extends { column: string; archivedAt?: number; completedAt?: number }>(
  task: T, view: ViewMode, date: Date, archiveDay = ''
): boolean {
  if (view === 'archive') {
    return !!task.archivedAt && (!archiveDay || localDay(new Date(task.completedAt ?? task.archivedAt)) === archiveDay);
  }
  if (task.archivedAt) return false;
  if (view === 'all' || task.column !== 'done') return true;
  const completed = task.completedAt ? localDay(new Date(task.completedAt)) : '';
  return view === 'today' ? completed === localDay(date) : completed >= weekStart(date) && completed <= localDay(date);
}
