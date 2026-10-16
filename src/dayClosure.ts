import type { Data } from './main';
import { dateFromDay, localDay } from './schedule.ts';
import { dailyPlan, planTask } from './dailyPlan.ts';

export type DayChoice = 'tomorrow' | 'backlog' | 'keep';
export type DayClosure = {
  id: string;
  day: string;
  closedAt: number;
  completedTaskIds: string[];
  decisions: Array<{ taskId: string; choice: DayChoice }>;
  focusSeconds: number;
  plannedMinutes: number;
};
export function followingDay(day: string) {
  const date = dateFromDay(day);
  date.setDate(date.getDate() + 1);
  return localDay(date);
}
export function closeDay(
  data: Data,
  day: string,
  choices: Record<string, DayChoice>,
  now: number,
): { data: Data; error?: string } {
  if (data.session) return { data, error: 'Encerre o ciclo ou a pausa antes de fechar o dia.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || localDay(dateFromDay(day)) !== day || day > localDay(new Date(now)))
    return { data, error: 'Escolha hoje ou um dia anterior válido.' };
  const plan = dailyPlan(data.tasks, day);
  if (!plan.ordered.length) return { data, error: 'Este dia não tem tarefas no plano.' };
  if (plan.pending.some(task => !['tomorrow', 'backlog', 'keep'].includes(choices[task.id])))
    return { data, error: 'Escolha o destino de cada pendência antes de salvar.' };
  let tasks = data.tasks;
  for (const task of plan.pending) {
    if (choices[task.id] === 'tomorrow') tasks = planTask(tasks, task.id, followingDay(day));
    if (choices[task.id] === 'backlog') tasks = planTask(tasks, task.id, undefined);
  }
  const closure: DayClosure = {
    id: day,
    day,
    closedAt: now,
    completedTaskIds: plan.ordered.filter(task => task.column === 'done').map(task => task.id),
    decisions: plan.pending.map(task => ({ taskId: task.id, choice: choices[task.id] })),
    focusSeconds: data.history
      .filter(event => localDay(new Date(event.at)) === day && event.seconds > 0)
      .reduce((sum, event) => sum + event.seconds, 0),
    plannedMinutes: plan.ordered.reduce((sum, task) => sum + task.estimate, 0),
  };
  return {
    data: { ...data, tasks, dayClosures: [...(data.dayClosures ?? []).filter(item => item.day !== day), closure] },
  };
}
