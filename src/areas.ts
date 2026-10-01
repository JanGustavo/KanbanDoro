import type { Data } from './main';
export function removeArea<T extends Pick<Data, 'areas' | 'tasks' | 'weeklyPlans'>>(data: T, area: string): T {
  const matches = (value?: string) => value?.trim().toLocaleLowerCase() === area.trim().toLocaleLowerCase();
  return {
    ...data,
    areas: data.areas.filter(name => !matches(name)),
    tasks: data.tasks.map(task => (matches(task.skill) ? { ...task, skill: undefined } : task)),
    weeklyPlans: data.weeklyPlans.map(plan => (matches(plan.skill) ? { ...plan, skill: undefined } : plan)),
  };
}
