import assert from 'node:assert/strict';
import { saveTaskSchedule } from '../src/taskScheduling.ts';

const now = new Date(2026, 9, 5, 12);
const task = {
  id: 'original',
  name: 'Estudar',
  description: 'Capítulo 1',
  difficulty: 1,
  estimate: 25,
  deadline: '',
  column: 'doing',
  focusSeconds: 100,
  failures: 1,
  slices: [{ id: 'slice', name: 'Ler', done: true }],
};
const data = {
  tasks: [task],
  weeklyPlans: [],
  history: [{ id: 'event', taskId: task.id, seconds: 100 }],
  session: null,
};
const choice = { mode: 'weekly', startDate: '2026-10-05', weekdays: [1, 3], reminderTime: '14:00' };
const create = (plan, day) => ({
  ...task,
  id: `new:${day}`,
  planId: plan.id,
  occurrenceDate: day,
  column: 'todo',
  focusSeconds: 0,
});
const saved = saveTaskSchedule(data, task.id, choice, now, () => 'routine', create);
assert.equal(saved.tasks.length, 1, 'conversion uses the original task as today’s occurrence');
assert.equal(saved.tasks[0].occurrenceDate, '2026-10-05');
assert.equal(saved.tasks[0].focusSeconds, 100);
assert.equal(saved.tasks[0].slices[0].done, true);
assert.equal(saved.history, data.history, 'conversion preserves focus history');
assert.equal(saved.weeklyPlans[0].reminderTime, '14:00');
const twice = saveTaskSchedule(saved, task.id, choice, now, () => 'unused', create);
assert.equal(twice.tasks.length, 1);
assert.equal(twice.weeklyPlans.length, 1);
assert.equal(twice.weeklyPlans[0].id, 'routine', 'editing retains routine identity and generated dates');
const nextWeek = saveTaskSchedule(data, task.id, { ...choice, startDate: '2026-10-12' }, now, () => 'future', create);
assert.equal(nextWeek.tasks[0].occurrenceDate, undefined, 'future recurrence does not consume today');
assert.deepEqual(nextWeek.weeklyPlans[0].generatedDates, []);
const finite = saveTaskSchedule(data, task.id, { ...choice, mode: 'selected-days' }, now, () => 'finite', create);
assert.equal(finite.weeklyPlans[0].endsOn, '2026-10-11');
const withPast = {
  ...saved,
  tasks: [...saved.tasks, { ...task, id: 'past', planId: 'routine', occurrenceDate: '2026-09-28' }],
};
const stopped = saveTaskSchedule(withPast, task.id, { ...choice, mode: 'once' }, now, () => 'unused', create);
assert.equal(stopped.weeklyPlans.length, 0);
assert.equal(stopped.tasks.length, 2);
assert.equal(stopped.tasks[0].planId, undefined);
assert.equal(stopped.tasks[0].reminderDate, '2026-10-05');
assert.equal(stopped.tasks[1], withPast.tasks[1], 'stopping recurrence preserves existing occurrences');
console.log('Conversão, edição e encerramento de recorrência preservam tarefas e histórico.');
