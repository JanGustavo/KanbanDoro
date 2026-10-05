import assert from 'node:assert/strict';
import { dailyPlan, planTask, movePlannedTask } from '../src/dailyPlan.ts';

const day = '2026-10-05';
const tasks = [
  {
    id: 'a',
    name: 'Preparar',
    column: 'todo',
    estimate: 40,
    focusSeconds: 120,
    slices: [{ id: 'slice', done: true }],
    files: [{ id: 'file' }],
  },
  { id: 'b', name: 'Retomar', column: 'late', estimate: 25 },
  { id: 'done', column: 'done', estimate: 10, plannedFor: day, plannedOrder: 0 },
  { id: 'archive', column: 'todo', estimate: 99, plannedFor: day, archivedAt: 1 },
  { id: 'old', column: 'doing', estimate: 20, plannedFor: '2026-10-04' },
];
const planned = planTask(planTask(tasks, 'a', day), 'b', day);
const summary = dailyPlan(planned, day);
assert.deepEqual(
  summary.pending.map(task => task.id),
  ['a', 'b'],
  'late tasks can be planned with todo tasks',
);
assert.equal(summary.minutes, 65, 'completed and archived work does not inflate remaining estimated effort');
assert.equal(summary.completed, 1);
assert.deepEqual(
  summary.ordered.map(task => task.id),
  ['done', 'a', 'b'],
);
const reordered = movePlannedTask(planned, day, 'b', -1);
assert.deepEqual(
  dailyPlan(reordered, day).pending.map(task => task.id),
  ['b', 'a'],
);
assert.equal(
  reordered.find(task => task.id === 'old'),
  tasks[4],
  'ordering today preserves earlier plans',
);
const removed = planTask(reordered, 'a', undefined);
assert.equal(dailyPlan(removed, day).minutes, 25);
const original = removed.find(task => task.id === 'a');
assert.equal(original.focusSeconds, 120);
assert.equal(original.slices, tasks[0].slices);
assert.equal(original.files, tasks[0].files, 'removing from a plan preserves attachments and work');
assert.equal(original.column, 'todo');
assert.equal(original.plannedFor, undefined);
assert.equal(original.plannedOrder, undefined);
assert.equal(
  dailyPlan(reordered, '2026-10-06').ordered.length,
  0,
  'a new day does not silently inherit yesterday’s commitments',
);
assert.equal(movePlannedTask(reordered, day, 'missing', 1), reordered);
assert.equal(movePlannedTask(reordered, day, 'done', -1), reordered, 'moving beyond plan boundaries is harmless');
console.log('Plano diário: ordem, esforço pendente, troca de dia e preservação de tarefas validados.');
