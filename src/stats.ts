import { localDay, weekStart } from './schedule';

type TaskRecord = { id: string; skill?: string; estimate: number; focusSeconds: number; failures: number; column: string; completedAt?: number; createdAt?: number; archivedAt?: number };
type FocusRecord = { taskId: string; seconds: number; at: number; kind: string };
export type AreaMetrics = { name: string; tasks: number; completed: number; measured: number; withinEstimate: number; focusSeconds: number; failures: number; estimatedMinutes: number; actualMinutes: number };

export function calculateStats(tasks: TaskRecord[], history: FocusRecord[], now: number) {
  const areas = new Map<string, AreaMetrics>();
  for (const task of tasks) {
    const name = task.skill?.trim() || 'Sem categoria';
    const area = areas.get(name) ?? { name, tasks: 0, completed: 0, measured: 0, withinEstimate: 0, focusSeconds: 0, failures: 0, estimatedMinutes: 0, actualMinutes: 0 };
    area.tasks++;
    area.focusSeconds += Math.max(0, task.focusSeconds || 0);
    area.failures += Math.max(0, task.failures || 0);
    if (task.column === 'done') {
      area.completed++;
      if (task.estimate > 0 && task.focusSeconds > 0) {
        area.measured++;
        area.estimatedMinutes += task.estimate;
        area.actualMinutes += task.focusSeconds / 60;
        if (task.focusSeconds <= task.estimate * 60) area.withinEstimate++;
      }
    }
    areas.set(name, area);
  }
  const start = new Date(now);
  const monday = weekStart(start);
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Number(monday.slice(0, 4)), Number(monday.slice(5, 7)) - 1, Number(monday.slice(8, 10)) + index, 12);
    return { day: localDay(date), seconds: 0 };
  });
  const present = new Set(tasks.map(task => task.id));
  for (const entry of history) {
    if (!present.has(entry.taskId) || !Number.isFinite(entry.at) || !Number.isFinite(entry.seconds) || entry.seconds <= 0 || entry.at > now) continue;
    const day = localDay(new Date(entry.at));
    const bucket = daily.find(item => item.day === day);
    if (bucket) bucket.seconds += entry.seconds;
  }
  const values = [...areas.values()].sort((a, b) => b.focusSeconds - a.focusSeconds || a.name.localeCompare(b.name));
  return {
    areas: values,
    daily,
    totalFocusSeconds: values.reduce((sum, area) => sum + area.focusSeconds, 0),
    totalFailures: values.reduce((sum, area) => sum + area.failures, 0),
    totalCompleted: values.reduce((sum, area) => sum + area.completed, 0),
    measured: values.reduce((sum, area) => sum + area.measured, 0),
    withinEstimate: values.reduce((sum, area) => sum + area.withinEstimate, 0),
    weeklyFocusSeconds: daily.reduce((sum, day) => sum + day.seconds, 0),
    activeDays: daily.filter(day => day.seconds > 0).length,
    doingCount: tasks.filter(task => task.column === 'doing' && !task.archivedAt).length,
    lateCount: tasks.filter(task => task.column === 'late' && !task.archivedAt).length,
  };
}
