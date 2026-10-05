import assert from 'node:assert/strict';
import { makeBackup, mergeBackup, parseBackup } from '../src/backup.ts';

const item = {
  id: 'one',
  name: 'Estudar',
  description: 'Linux',
  difficulty: 1,
  estimate: 30,
  deadline: '',
  plannedFor: '2026-10-05',
  plannedOrder: 2,
  reminderDate: '2026-10-05',
  reminderTime: '14:30',
  column: 'doing',
  failures: 0,
  focusSeconds: 200,
  slices: [{ id: 'slice-1', name: 'Ler', done: false }],
  notes: 'Resumo da matéria',
  files: [{ id: 'file-1', name: 'aula.pdf', size: 100, type: 'application/pdf', addedAt: 10 }],
  apiKey: 'this-field-must-never-be-exported',
};
const data = {
  tasks: [item],
  history: [{ id: 'event-1', taskId: 'one', kind: 'completed', seconds: 200, at: 10, sliceIds: [] }],
  weeklyPlans: [
    {
      id: 'plan-1',
      name: 'Revisão',
      estimate: 20,
      weekdays: [1],
      startsOn: '2026-09-27',
      reminderTime: '09:15',
      generatedDates: ['2026-09-27'],
    },
  ],
  breakPreferences: ['Água'],
  wipLimits: { doing: 5, late: null },
  breakDurations: { short: 5, long: 15 },
  areas: ['Programação'],
  session: { phase: 'running', token: 'never-export-this-session' },
};
const blocking = { mode: 'custom', exceptions: [], customDomains: ['example.com'] };
const backup = makeBackup(data, blocking, true);
const serialized = JSON.stringify(backup);
assert.equal(backup.schemaVersion, 1);
assert(!serialized.includes('never-export-this-session'));
assert(!serialized.includes('this-field-must-never-be-exported'));
assert.equal(backup.data.tasks[0].focusSeconds, 200);
assert.deepEqual(backup.data.areas, ['Programação']);
assert.equal(backup.data.tasks[0].notes, 'Resumo da matéria');
assert.equal(backup.data.tasks[0].files, undefined);
assert(!serialized.includes('aula.pdf'));

const imported = parseBackup(serialized);
assert.equal(imported.data.tasks[0].plannedFor, '2026-10-05');
assert.equal(imported.data.tasks[0].plannedOrder, 2);
assert.equal(imported.data.tasks[0].reminderDate, '2026-10-05');
assert.equal(imported.data.tasks[0].reminderTime, '14:30');
assert.equal(imported.data.weeklyPlans[0].reminderTime, '09:15');
assert.throws(
  () =>
    parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, tasks: [{ ...item, reminderTime: '24:00' }] } })),
  /Horário inválido/,
);
assert.equal(imported.data.tasks[0].slices[0].name, 'Ler');
const withSliceNotes = parseBackup(
  JSON.stringify({
    ...backup,
    data: {
      ...backup.data,
      tasks: [{ ...item, slices: [{ ...item.slices[0], notes: 'Pratiquei grep e find', files: item.files }] }],
    },
  }),
);
assert.equal(withSliceNotes.data.tasks[0].slices[0].notes, 'Pratiquei grep e find');
assert.equal(withSliceNotes.data.tasks[0].slices[0].files, undefined);
const withPreview = parseBackup(
  JSON.stringify({
    ...backup,
    data: {
      ...backup.data,
      tasks: [
        {
          ...item,
          attachments: [
            {
              title: 'Pesquisa',
              url: 'https://example.org/article',
              verifiedAt: 100,
              reason: '',
              pageTitle: 'Hábitos de estudo',
              description: 'Texto da página',
              source: 'example.org',
              summary: 'Revisões curtas são úteis.',
            },
          ],
        },
      ],
    },
  }),
);
assert.equal(withPreview.data.tasks[0].attachments[0].summary, 'Revisões curtas são úteis.');
assert.equal(withPreview.data.tasks[0].attachments[0].pageTitle, 'Hábitos de estudo');
assert.equal(imported.data.weeklyPlans[0].generatedDates.length, 1);
assert.throws(() => parseBackup(serialized.replace('"schemaVersion":1', '"schemaVersion":2')), /Versão/);
assert.throws(
  () =>
    parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, tasks: [{ ...item, deadline: '2026-02-30' }] } })),
  /Data inválida/,
);
assert.throws(
  () => parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, tasks: [item, item] } })),
  /duplicados/,
);
const another = parseBackup(
  JSON.stringify({
    ...backup,
    data: {
      ...backup.data,
      tasks: [
        { ...item, name: 'Importado' },
        { ...item, id: 'two', name: 'Nova' },
      ],
      weeklyPlans: [{ ...data.weeklyPlans[0], generatedDates: ['2026-09-28'] }],
    },
  }),
);
const merged = mergeBackup(backup, another);
assert.equal(merged.data.tasks.length, 2);
assert.equal(merged.data.tasks[0].name, 'Estudar', 'local data wins a collision');
assert.deepEqual(merged.data.weeklyPlans[0].generatedDates, ['2026-09-27', '2026-09-28']);
assert.equal(merged.data.history.length, 1, 'events from a colliding task cannot be assigned to the local task');
const collision = parseBackup(
  JSON.stringify({ ...backup, data: { ...backup.data, history: [{ ...data.history[0], id: 'foreign-event' }] } }),
);
assert.equal(mergeBackup(backup, collision).data.history.length, 1);
assert.throws(
  () =>
    parseBackup(
      JSON.stringify({ ...backup, data: { ...backup.data, history: [{ ...data.history[0], taskId: 'missing' }] } }),
    ),
  /ausentes/,
);
assert.throws(
  () =>
    parseBackup(
      JSON.stringify({
        ...backup,
        data: { ...backup.data, focusBlocking: { ...blocking, customDomains: ['bad_domain'] } },
      }),
    ),
  /Domínio inválido/,
);
assert.equal(
  parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, tasks: [{ ...item, planId: 'deleted-plan' }] } }))
    .data.tasks[0].planId,
  'deleted-plan',
  'past occurrences survive removal of a schedule',
);
console.log('Backup JSON, limpeza de credenciais e restauração sem duplicatas validados.');
