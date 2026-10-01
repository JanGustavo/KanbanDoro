import { dateFromDay, weekStart } from './schedule.ts';

type Task = {
  id: string;
  name?: string;
  skill?: string;
  estimate: number;
  focusSeconds: number;
  column: string;
  createdAt?: number;
  completedAt?: number;
  archivedAt?: number;
};
type Event = { taskId: string; at: number; seconds: number; kind: string };
export function weeklyReview(tasks: Task[], history: Event[], week: string, now: number) {
  const monday = weekStart(dateFromDay(week));
  const day = dateFromDay(monday);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 7).getTime();
  const exists = new Set(tasks.map(task => task.id));
  const valid = history.filter(
    event =>
      exists.has(event.taskId) &&
      Number.isFinite(event.at) &&
      event.at <= now &&
      Number.isFinite(event.seconds) &&
      event.seconds >= 0,
  );
  const events = valid.filter(event => event.at >= start && event.at < end);
  const completed = tasks.filter(
    task =>
      task.column === 'done' &&
      task.completedAt !== undefined &&
      task.completedAt >= start &&
      task.completedAt < end &&
      task.completedAt <= now,
  );
  const pending = tasks.filter(task => !task.archivedAt && task.column !== 'done');
  const latest = new Map<string, number>();
  for (const event of valid) latest.set(event.taskId, Math.max(latest.get(event.taskId) ?? 0, event.at));
  const stalled = pending.filter(
    task => ['doing', 'late'].includes(task.column) && (latest.get(task.id) ?? task.createdAt ?? now) < start,
  );
  const areas = new Map<
    string,
    { area: string; sample: number; plannedMinutes: number; actualMinutes: number; ratios: number[] }
  >();
  for (const task of completed) {
    if (!(
      task.focusSeconds > 0 &&
      Number.isFinite(task.focusSeconds) &&
      task.estimate > 0 &&
      Number.isFinite(task.estimate)
    ))
      continue;
    const name = task.skill?.trim() || 'Sem categoria';
    const area = areas.get(name) ?? { area: name, sample: 0, plannedMinutes: 0, actualMinutes: 0, ratios: [] };
    area.sample++;
    area.plannedMinutes += task.estimate;
    area.actualMinutes += task.focusSeconds / 60;
    area.ratios.push(task.focusSeconds / (task.estimate * 60));
    areas.set(name, area);
  }
  const measured = [...areas.values()]
    .map(({ ratios, ...area }) => {
      ratios.sort((a, b) => a - b);
      const middle = Math.floor(ratios.length / 2);
      const ratio = ratios.length % 2 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2;
      return { ...area, medianRatio: Math.round(ratio * 100) / 100, smallSample: area.sample < 3 };
    })
    .sort((a, b) => a.area.localeCompare(b.area));
  const adjustments = measured.filter(
    area => !area.smallSample && (area.medianRatio > 1.25 || area.medianRatio < 0.75),
  );
  const suggestion = adjustments.length
    ? `Revise a estimativa de uma próxima tarefa de ${adjustments[0].area}, usando os tempos medidos como referência.`
    : stalled.length
      ? 'Escolha uma tarefa que ficou parada e defina uma etapa pequena para retomá-la.'
      : 'Mantenha o registro de foco e revise a estimativa de uma tarefa ao encerrá-la.';
  return {
    week: monday,
    start,
    end,
    completed,
    pending,
    stalled,
    events,
    focusSeconds: events.reduce((sum, event) => sum + event.seconds, 0),
    areas: measured,
    adjustments,
    suggestion,
  };
}
export function weeklyAIPayload(review: ReturnType<typeof weeklyReview>, previous: ReturnType<typeof weeklyReview>) {
  // No task names, free text, attachments, file contents, tokens or individual history events.
  const compact = (value: ReturnType<typeof weeklyReview>) => ({
    week: value.week,
    completed: value.completed.length,
    focusMinutes: Math.round(value.focusSeconds / 60),
    areas: value.areas
      .slice(0, 50)
      .map(area => ({
        ...area,
        plannedMinutes: Math.round(area.plannedMinutes),
        actualMinutes: Math.round(area.actualMinutes),
      })),
  });
  return {
    current: compact(review),
    previous: compact(previous),
    pendingSnapshot: 'Estado atual do quadro, não uma reconstrução da semana selecionada',
    pendingNow: review.pending.length,
    stalledNow: review.stalled.length,
    measurement:
      'Estimativas e foco total de tarefas concluídas na semana; foco semanal é calculado pelos eventos no período. Amostras inferiores a 3 são pequenas. Sem score de produtividade.',
  };
}
