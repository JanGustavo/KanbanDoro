import type { Task } from './main';

export type ResumePoint = { sliceId?: string; stoppedAt: string; nextStep: string; savedAt: number };

export function resumeSlice(task: Task) {
  return (
    task.slices.find(slice => slice.id === task.resumePoint?.sliceId && !slice.done) ??
    task.slices.find(slice => !slice.done)
  );
}

export function saveResumePoint(task: Task, change: Partial<ResumePoint>, now: number): Task {
  const current = task.resumePoint ?? { stoppedAt: '', nextStep: '', savedAt: now };
  const point = { ...current, ...change, savedAt: now };
  return {
    ...task,
    resumePoint: {
      ...point,
      sliceId: task.slices.some(slice => slice.id === point.sliceId) ? point.sliceId : undefined,
      stoppedAt: point.stoppedAt.slice(0, 2000),
      nextStep: point.nextStep.slice(0, 2000),
    },
  };
}

export function latestResumable(tasks: Task[]) {
  return tasks
    .filter(task => task.resumePoint && task.column !== 'done' && !task.archivedAt)
    .sort((a, b) => (b.resumePoint?.savedAt ?? 0) - (a.resumePoint?.savedAt ?? 0))[0];
}
