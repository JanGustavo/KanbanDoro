export type Plannable = {
  id: string;
  column: string;
  estimate: number;
  archivedAt?: number;
  plannedFor?: string;
  plannedOrder?: number;
};

export function dailyPlan<T extends Plannable>(tasks: T[], day: string) {
  const ordered = tasks
    .filter(task => task.plannedFor === day && !task.archivedAt)
    .sort((a, b) => (a.plannedOrder ?? Number.MAX_SAFE_INTEGER) - (b.plannedOrder ?? Number.MAX_SAFE_INTEGER));
  const pending = ordered.filter(task => task.column !== 'done');
  return {
    ordered,
    pending,
    completed: ordered.length - pending.length,
    minutes: pending.reduce((sum, task) => sum + task.estimate, 0),
  };
}

export function planTask<T extends Plannable>(tasks: T[], taskId: string, day: string | undefined): T[] {
  const order = day
    ? dailyPlan(tasks, day).ordered.reduce((max, task) => Math.max(max, task.plannedOrder ?? 0), -1) + 1
    : undefined;
  return tasks.map(task => (task.id === taskId ? { ...task, plannedFor: day, plannedOrder: order } : task));
}

export function movePlannedTask<T extends Plannable>(tasks: T[], day: string, taskId: string, offset: -1 | 1): T[] {
  const ordered = dailyPlan(tasks, day).ordered;
  const index = ordered.findIndex(task => task.id === taskId);
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return tasks;
  [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
  const positions = new Map(ordered.map((task, position) => [task.id, position]));
  return tasks.map(task => (positions.has(task.id) ? { ...task, plannedOrder: positions.get(task.id) } : task));
}
