import assert from 'node:assert/strict';
import { weeklyReview, weeklyAIPayload } from '../src/weeklyReview.ts';
const at = value => new Date(value).getTime();
const now = at('2026-10-01T15:00:00');
const base = {
  name: 'PRIVATE TASK',
  description: 'PRIVATE DESCRIPTION',
  notes: 'PRIVATE NOTES',
  attachments: ['PRIVATE LINK'],
  column: 'done',
  skill: 'Estudo',
  estimate: 10,
  focusSeconds: 1200,
  completedAt: at('2026-09-29T10:00:00'),
};
const tasks = [0, 1, 2].map(index => ({ ...base, id: `t${index}` }));
tasks.push({ ...base, id: 'previous', completedAt: at('2026-09-27T10:00:00') });
tasks.push({ ...base, id: 'undated', completedAt: undefined });
tasks.push({ ...base, id: 'stalled', column: 'doing', completedAt: undefined, createdAt: at('2026-09-20T10:00:00') });
tasks.push({ ...base, id: 'archived', archivedAt: at('2026-09-30T10:00:00'), focusSeconds: 0 });
const history = [
  { taskId: 't0', seconds: 120, at: at('2026-09-28T00:00:00'), kind: 'completed' },
  { taskId: 'previous', seconds: 180, at: at('2026-09-27T23:59:59'), kind: 'completed' },
  { taskId: 't0', seconds: 900, at: at('2026-10-05T00:00:00'), kind: 'completed' },
  { taskId: 'stalled', seconds: 20, at: at('2026-09-26T12:00:00'), kind: 'interrupted' },
  { taskId: 'deleted', seconds: 10000, at: now, kind: 'completed' },
  { taskId: 't0', seconds: -10, at: now, kind: 'completed' },
  { taskId: 't0', seconds: NaN, at: now, kind: 'completed' },
];
const current = weeklyReview(tasks, history, '2026-10-01', now);
const previous = weeklyReview(tasks, history, '2026-09-21', now);
assert.equal(current.week, '2026-09-28');
assert.equal(current.completed.length, 4, 'archived conclusions still count');
assert.equal(
  current.focusSeconds,
  120,
  'inclusive Monday, exclusive next Monday, future/invalid/deleted events excluded',
);
assert.equal(previous.completed.length, 1);
assert.equal(current.areas[0].sample, 3, 'unmeasured conclusions excluded from estimates');
assert.equal(current.areas[0].plannedMinutes, 30);
assert.equal(
  current.areas[0].actualMinutes,
  60,
  'use lifetime focus for completed task estimates, not weekly event sums',
);
assert.equal(current.areas[0].medianRatio, 2);
assert.equal(current.adjustments.length, 1);
assert.equal(current.stalled.length, 1);
const small = weeklyReview([tasks[0]], history, '2026-09-28', now);
assert.equal(small.areas[0].smallSample, true);
assert.equal(small.adjustments.length, 0, 'small samples do not trigger confident calibration');
const payload = JSON.stringify(weeklyAIPayload(current, previous));
assert(!payload.includes('PRIVATE'));
assert(!payload.includes('taskId'));
assert(!payload.includes('description'));
assert(payload.includes('Estudo'));
assert(payload.includes('Estado atual'));
const empty = weeklyReview([], [], '2026-09-28', now);
assert.equal(empty.focusSeconds, 0);
assert.equal(empty.areas.length, 0);
console.log(
  'Revisão semanal: períodos locais, amostras, coortes de estimativa, comparação e payload sem dados de tarefas verificados.',
);
