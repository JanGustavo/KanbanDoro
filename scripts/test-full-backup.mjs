import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { makeBackup, parseBackup } from '../src/backup.ts';
import { exportFullBackup, parseFullBackup, restoreFullBackup, referencedFiles } from '../src/fullBackup.ts';
import {
  saveLocalFile,
  getLocalFile,
  stageLocalFiles,
  finishLocalFiles,
  pruneLocalFiles,
  MAX_LOCAL_FILE_BYTES,
} from '../src/localFiles.ts';
import { APP_VERSION } from '../src/appVersion.ts';
const file = await saveLocalFile(new File(['minhas notas de estudo'], 'revisão.txt', { type: 'text/plain' }));
const picture = await saveLocalFile(new File([new Uint8Array([137, 80, 78, 71])], 'imagem.png', { type: 'image/png' }));
const task = {
  id: 'task-1',
  name: 'Estudar',
  description: 'Revisar',
  difficulty: 2,
  estimate: 40,
  deadline: '',
  column: 'todo',
  failures: 0,
  focusSeconds: 0,
  notes: 'Aprendi…',
  files: [file],
  slices: [{ id: 'slice-1', name: 'Exercícios', done: false, notes: 'Resumo', files: [picture, file] }],
};
const data = {
  tasks: [task],
  history: [],
  weeklyPlans: [],
  breakPreferences: ['Água'],
  wipLimits: { doing: 5, late: null },
  breakDurations: { short: 5, long: 15 },
  areas: ['Estudo'],
  session: { apiKey: 'never-export' },
  apiKey: 'secret',
};
const blocking = { mode: 'off', exceptions: [], customDomains: [] };
const snapshot = makeBackup(data, blocking, true, true);
assert.equal(snapshot.appVersion, APP_VERSION);
assert(!JSON.stringify(snapshot).includes('secret'));
assert(!('session' in snapshot.data));
assert.equal(referencedFiles(snapshot).length, 2, 'shared attachments should be exported only once');
const bytes = await exportFullBackup(snapshot);
const parsed = await parseFullBackup(bytes);
assert.equal(parsed.files.size, 2);
assert.equal(new TextDecoder().decode(parsed.files.get(file.id)), 'minhas notas de estudo');
assert.deepEqual([...parsed.files.get(picture.id)], [137, 80, 78, 71]);
assert.equal(parsed.backup.data.tasks[0].slices[0].notes, 'Resumo');
assert.equal(parseBackup(JSON.stringify(snapshot)).data.tasks[0].files, undefined, 'legacy JSON remains text-only');
const empty = makeBackup({ ...data, tasks: [] }, blocking, true, true);
let saved;
const restored = await restoreFullBackup(empty, parsed, 'replace', async next => {
  saved = next;
});
const importedFile = restored.data.tasks[0].files[0];
assert.notEqual(importedFile.id, file.id, 'restore must remap file IDs');
assert.equal(importedFile.id, saved.data.tasks[0].slices[0].files[1].id, 'shared references stay shared');
assert.equal(await (await getLocalFile(importedFile.id)).text(), 'minhas notas de estudo');
assert.equal(await (await getLocalFile(file.id)).text(), 'minhas notas de estudo', 'the old file is intact');
const merged = await restoreFullBackup(snapshot, parsed, 'merge', async () => {});
assert.equal(merged.data.tasks.length, 1);
assert.equal(merged.data.tasks[0].files[0].id, file.id, 'colliding local tasks win without rewriting their files');
let failedIds = [];
await assert.rejects(
  restoreFullBackup(empty, parsed, 'replace', async next => {
    failedIds = referencedFiles(next).map(file => file.id);
    throw Error('storage failure');
  }),
  /storage failure/,
);
for (const id of failedIds)
  assert.equal(await getLocalFile(id), undefined, 'failed Chrome writes roll back newly staged files');
const stagedId = crypto.randomUUID();
await stageLocalFiles([{ id: stagedId, blob: new Blob(['pending']) }]);
await pruneLocalFiles(new Set([file.id, picture.id, importedFile.id]));
assert.equal(await (await getLocalFile(stagedId)).text(), 'pending', 'another tab must not prune an in-flight import');
await finishLocalFiles([stagedId], false);
const entries = unzipSync(bytes);
const missing = { ...entries };
delete missing[`files/${file.id}`];
await assert.rejects(parseFullBackup(zipSync(missing)), /Manifesto|ausente/);
const corrupt = { ...entries, [`files/${file.id}`]: strToU8('notas corrompidas aqui') };
await assert.rejects(parseFullBackup(zipSync(corrupt)), /corrompido/);
await assert.rejects(parseFullBackup(zipSync({ ...entries, '../evil': new Uint8Array([1]) })), /Entradas inválidas/);
await assert.rejects(parseFullBackup(bytes.subarray(0, 20)), /ZIP|zip|invalid|incomplete|incompleto/i);
await assert.rejects(
  parseFullBackup(zipSync({ 'files/oversized': new Uint8Array(MAX_LOCAL_FILE_BYTES + 1) }, { level: 9 })),
  /limite/,
);
const noBlob = structuredClone(snapshot);
noBlob.data.tasks[0].files[0].id = 'missing-file';
noBlob.data.tasks[0].slices[0].files.pop();
await assert.rejects(exportFullBackup(noBlob), /ausente/);
const inconsistent = structuredClone(snapshot);
inconsistent.data.tasks[0].slices[0].files[1].size++;
assert.throws(() => referencedFiles(inconsistent), /conflitantes/);
console.log(
  'ZIP: roundtrip de arquivos da tarefa/etapas, compatibilidade JSON, integridade, limites, colisões e rollback verificados.',
);
