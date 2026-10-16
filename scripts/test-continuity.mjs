import assert from 'node:assert/strict';
import { latestResumable, resumeSlice, saveResumePoint } from '../src/continuity.ts';
import { closeDay } from '../src/dayClosure.ts';
import { reminderDestination, canMaterializeReminder } from '../src/reminderNavigation.ts';
import { workflowContext, workflowProfiles } from '../src/workflowProfiles.ts';

const task = {
  id: 'a',
  name: 'Estudar',
  column: 'doing',
  estimate: 40,
  focusSeconds: 120,
  plannedFor: '2026-10-16',
  slices: [
    { id: 'done', name: 'Ler', done: true },
    { id: 'next', name: 'Praticar', done: false },
  ],
  files: [{ id: 'file' }],
};
const point = saveResumePoint(task, { sliceId: 'done', stoppedAt: 'Página 18', nextStep: 'Resolver exercício 4' }, 100);
assert.equal(resumeSlice(point).id, 'next', 'a completed reference does not restart a finished slice');
assert.equal(point.files, task.files);
assert.equal(point.focusSeconds, 120);
const removed = saveResumePoint(point, { sliceId: 'deleted' }, 101);
assert.equal(removed.resumePoint.sliceId, undefined);
assert.equal(resumeSlice(removed).id, 'next');
assert.equal(
  latestResumable([{ ...point, id: 'archived', archivedAt: 1 }, { ...point, id: 'completed', column: 'done' }, removed])
    .id,
  'a',
);
assert.equal(saveResumePoint(task, { nextStep: 'a'.repeat(3000) }, 102).resumePoint.nextStep.length, 2000);
const data = {
  tasks: [
    point,
    { ...task, id: 'b', column: 'todo', estimate: 25 },
    { ...task, id: 'c', column: 'done', estimate: 10 },
    { ...task, id: 'future', plannedFor: '2026-10-17', plannedOrder: 0 },
  ],
  history: [
    { taskId: 'a', seconds: 120, at: new Date(2026, 9, 16, 10).getTime() },
    { taskId: 'a', seconds: 50, at: new Date(2026, 9, 15, 10).getTime() },
  ],
  session: null,
  dayClosures: [],
};
const now = new Date(2026, 9, 16, 20).getTime();
assert.match(closeDay(data, '2026-10-16', {}, now).error, /destino/);
assert.equal(closeDay(data, '2026-10-16', {}, now).data, data, 'incomplete decisions cannot partially move tasks');
assert.match(closeDay({ ...data, session: {} }, '2026-10-16', { a: 'tomorrow', b: 'backlog' }, now).error, /ciclo/);
assert.match(closeDay(data, '2026-02-30', {}, now).error, /válido/);
assert.match(closeDay(data, '2026-10-17', {}, now).error, /válido/);
const closed = closeDay(data, '2026-10-16', { a: 'tomorrow', b: 'backlog' }, now).data;
assert.equal(closed.tasks.length, data.tasks.length, 'closing a day never clones a task');
assert.equal(closed.tasks[0].plannedFor, '2026-10-17');
assert(
  closed.tasks[0].plannedOrder > closed.tasks[3].plannedOrder,
  'moved work follows commitments already on tomorrow’s plan',
);
assert.equal(closed.tasks[1].plannedFor, undefined);
assert.equal(closed.tasks[0].resumePoint, point.resumePoint);
assert.equal(closed.tasks[0].files, task.files);
assert.equal(closed.tasks[2], data.tasks[2]);
assert.equal(closed.history, data.history);
assert.equal(closed.dayClosures[0].focusSeconds, 120, 'the closure counts only real focus from that calendar day');
assert.deepEqual(closed.dayClosures[0].completedTaskIds, ['c']);
const kept = closeDay(data, '2026-10-16', { a: 'keep', b: 'keep' }, now).data;
assert.equal(kept.tasks, data.tasks);
assert.equal(
  closeDay(kept, '2026-10-16', { a: 'keep', b: 'keep' }, now + 1).data.dayClosures.length,
  1,
  'a closure revision does not duplicate the date',
);
assert.deepEqual(reminderDestination('#from=reminder&plan=p&day=2026-10-16&intent=focus'), {
  taskId: undefined,
  planId: 'p',
  day: '2026-10-16',
  intent: 'focus',
});
assert.equal(reminderDestination('#task=a'), null);
const routine = { id: 'p', name: 'Rotina', estimate: 25, weekdays: [5], startsOn: '2026-10-01', generatedDates: [] };
assert.equal(canMaterializeReminder(routine, '2026-10-16', new Date(now)), true);
assert.equal(
  canMaterializeReminder({ ...routine, weekdays: [1] }, '2026-10-16', new Date(now)),
  false,
  'an unselected day cannot cause repeated materialization attempts',
);
assert.equal(canMaterializeReminder({ ...routine, endsOn: '2026-10-15' }, '2026-10-16', new Date(now)), false);
assert.equal(
  canMaterializeReminder({ ...routine, generatedDates: ['2026-10-16'] }, '2026-10-16', new Date(now)),
  false,
  'deleted generated occurrences stay deleted',
);
assert.equal(
  canMaterializeReminder(routine, '2026-10-09', new Date(now)),
  false,
  'clicks cannot backfill a week of missed tasks',
);

assert.equal(reminderDestination('#from=reminder&plan=p'), null);
assert.equal(reminderDestination('#from=reminder&plan=p&day=2026-02-31'), null);
assert.equal(reminderDestination('#from=reminder&task=' + 'a'.repeat(121)), null);
assert.equal(workflowContext({ profile: 'unknown', goal: 'x'.repeat(600) }).profile, 'general');
assert.equal(workflowContext({ profile: 'study', goal: '  Concurso  ' }).goal, 'Concurso');
assert.equal(workflowContext({ profile: 'study', goal: 'x'.repeat(600) }).goal.length, 500);
assert.deepEqual(
  workflowProfiles.map(profile => profile.id),
  ['general', 'study'],
);
console.log('Retomada, fechamento atômico do dia, destinos de lembrete e perfis de uso validados.');
