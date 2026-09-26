import assert from 'node:assert/strict';
import { isVisible, localDay, materializeToday, weekStart } from '../src/schedule.ts';

const monday = new Date(2026, 8, 21, 10);
assert.equal(localDay(monday), '2026-09-21');
assert.equal(weekStart(new Date(2026, 8, 27)), '2026-09-21');

const plan = { id: 'routine', name: 'Verificar e-mails', estimate: 20, weekdays: [1, 2, 3, 4, 5], startsOn: '2026-09-21', generatedDates: [] };
const create = (item, day) => ({ id: `${item.id}:${day}`, planId: item.id, occurrenceDate: day, column: 'todo' });
const first = materializeToday([], [plan], monday, create);
assert.equal(first.tasks.length, 1);
const twice = materializeToday(first.tasks, first.plans, monday, create);
assert.equal(twice.tasks.length, 1, 'reopening the board must not duplicate an occurrence');
const deleted = materializeToday([], first.plans, monday, create);
assert.equal(deleted.tasks.length, 0, 'deleting a daily occurrence must not recreate it that day');
const tuesday = materializeToday([], first.plans, new Date(2026, 8, 22, 10), create);
assert.equal(tuesday.tasks.length, 1, 'the next scheduled day receives a new occurrence');
assert.equal(materializeToday([], first.plans, new Date(2026, 8, 27), create).tasks.length, 0);

const done = { column: 'done', completedAt: new Date(2026, 8, 21).getTime() };
assert.equal(isVisible(done, 'today', new Date(2026, 8, 22)), false);
assert.equal(isVisible(done, 'week', new Date(2026, 8, 22)), true);
assert.equal(isVisible({ ...done, archivedAt: Date.now() }, 'all', monday), false);
assert.equal(isVisible({ ...done, archivedAt: Date.now() }, 'archive', monday, '2026-09-21'), true);
console.log('Rotinas idempotentes e filtros de conclusão/arquivo validados.');
