import assert from 'node:assert/strict';
import { removeArea } from '../src/areas.ts';
const data = {
  areas: ['Programação', 'Fantasma'],
  tasks: [
    { id: '1', skill: 'Fantasma', notes: 'Resumo', files: [{ id: 'arquivo' }], focusSeconds: 123 },
    { id: '2', skill: 'Programação' },
  ],
  weeklyPlans: [{ id: 'r1', skill: 'fantasma' }],
  history: [{ taskId: '1', seconds: 123 }],
  session: { taskId: '1' },
};
const result = removeArea(data, 'Fantasma');
assert.deepEqual(result.areas, ['Programação']);
assert.equal(result.tasks[0].skill, undefined);
assert.equal(result.weeklyPlans[0].skill, undefined, 'recurrences cannot recreate a deleted classification');
assert.equal(result.tasks[1].skill, 'Programação');
assert.equal(result.tasks[0].notes, 'Resumo');
assert.deepEqual(result.tasks[0].files, data.tasks[0].files);
assert.equal(result.tasks[0].focusSeconds, 123);
assert.deepEqual(result.history, data.history);
assert.deepEqual(result.session, data.session);
assert.equal(data.tasks[0].skill, 'Fantasma', 'original snapshot is not mutated');
const inferred = removeArea({ ...data, areas: [] }, 'Fantasma');
assert.equal(inferred.tasks[0].skill, undefined, 'areas inferred from imported tasks can also be removed');
console.log('Áreas: remoção de catálogo, tarefas e rotinas sem perda de notas, anexos ou histórico verificada.');
