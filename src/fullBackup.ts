import { zipSync, Unzip, UnzipInflate, strToU8, strFromU8 } from 'fflate';
import { parseBackup, mergeBackup, MAX_BACKUP_BYTES, type Backup } from './backup.ts';
import { getLocalFile, stageLocalFiles, finishLocalFiles, MAX_LOCAL_FILE_BYTES, type LocalFile } from './localFiles.ts';

export const MAX_FULL_BACKUP_BYTES = 128 * 1024 * 1024;
const MAX_FILES = 100;
export type FullBackup = { backup: Backup; files: Map<string, Uint8Array>; bytes: number };
export function referencedFiles(backup: Backup): LocalFile[] {
  const files = new Map<string, LocalFile>();
  for (const task of backup.data.tasks)
    for (const file of [...(task.files ?? []), ...task.slices.flatMap(slice => slice.files ?? [])]) {
      const prior = files.get(file.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(file))
        throw Error('Metadados conflitantes para o mesmo arquivo.');
      files.set(file.id, file);
    }
  if (files.size > MAX_FILES) throw Error('O ZIP aceita até 100 arquivos.');
  return [...files.values()];
}
async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function exportFullBackup(backup: Backup): Promise<Uint8Array> {
  const checked = parseBackup(JSON.stringify(backup), true);
  const entries: Record<string, Uint8Array> = { 'backup.json': strToU8(JSON.stringify(checked)) };
  const manifest: { format: string; version: number; files: Array<{ id: string; size: number; sha256: string }> } = {
    format: 'kanbandoro-full-backup',
    version: 1,
    files: [],
  };
  let total = entries['backup.json'].length;
  for (const file of referencedFiles(checked)) {
    const blob = await getLocalFile(file.id);
    if (!blob || blob.size !== file.size)
      throw Error(`Arquivo ausente ou incompleto: ${file.name}. O ZIP não foi criado.`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    total += bytes.length;
    if (total > MAX_FULL_BACKUP_BYTES - 1024 * 1024) throw Error('Backup completo acima de 128 MB.');
    entries[`files/${file.id}`] = bytes;
    manifest.files.push({ id: file.id, size: bytes.length, sha256: await digest(bytes) });
  }
  entries['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(entries, { level: 0 });
}

/** Inspect every entry before any storage mutation; stream with strict expansion limits. */
export async function parseFullBackup(bytes: Uint8Array): Promise<FullBackup> {
  if (bytes.length > MAX_FULL_BACKUP_BYTES) throw Error('ZIP acima de 128 MB.');
  const entries = new Map<string, Uint8Array>();
  const names = new Set<string>();
  let expanded = 0;
  let failed: Error | undefined;
  const unzip = new Unzip(file => {
    const limit =
      file.name === 'backup.json' ? MAX_BACKUP_BYTES : file.name === 'manifest.json' ? 64 * 1024 : MAX_LOCAL_FILE_BYTES;
    if (
      !/^(backup\.json|manifest\.json|files\/[a-zA-Z0-9_-]{1,120})$/.test(file.name) ||
      names.has(file.name) ||
      names.size >= MAX_FILES + 2
    )
      throw Error('Entradas inválidas ou duplicadas no ZIP.');
    if (
      file.originalSize === undefined ||
      file.originalSize > limit ||
      expanded + file.originalSize > MAX_FULL_BACKUP_BYTES
    )
      throw Error('Tamanho descompactado acima do limite ou desconhecido.');
    names.add(file.name);
    let size = 0;
    const chunks: Uint8Array[] = [];
    file.ondata = (error, chunk, final) => {
      if (error) {
        failed = error;
        return;
      }
      size += chunk.length;
      expanded += chunk.length;
      if (size > limit || expanded > MAX_FULL_BACKUP_BYTES) throw Error('Conteúdo descompactado acima do limite.');
      chunks.push(chunk);
      if (final) {
        if (size !== file.originalSize) throw Error('Arquivo truncado no ZIP.');
        const result = new Uint8Array(size);
        let offset = 0;
        for (const part of chunks) {
          result.set(part, offset);
          offset += part.length;
        }
        entries.set(file.name, result);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
    if (failed) throw failed;
  }
  if (!entries.has('backup.json') || !entries.has('manifest.json') || entries.size !== names.size)
    throw Error('ZIP incompleto.');
  const backup = parseBackup(strFromU8(entries.get('backup.json')!), true);
  const manifest = JSON.parse(strFromU8(entries.get('manifest.json')!));
  const refs = referencedFiles(backup);
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    manifest.format !== 'kanbandoro-full-backup' ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== refs.length ||
    entries.size !== refs.length + 2
  )
    throw Error('Manifesto de arquivos inválido.');
  const files = new Map<string, Uint8Array>();
  for (const ref of refs) {
    const record = manifest.files.filter((item: { id: string }) => item?.id === ref.id);
    const content = entries.get(`files/${ref.id}`);
    if (
      record.length !== 1 ||
      !content ||
      content.length !== ref.size ||
      record[0].size !== ref.size ||
      (await digest(content)) !== record[0].sha256
    )
      throw Error(`Arquivo ausente ou corrompido: ${ref.name}.`);
    files.set(ref.id, content);
  }
  return { backup, files, bytes: expanded };
}

/** New file IDs prevent imported files from overwriting local attachments. Roll back if Chrome storage fails. */
export async function restoreFullBackup(
  current: Backup,
  incoming: FullBackup,
  mode: 'merge' | 'replace',
  persist: (backup: Backup) => Promise<void>,
): Promise<Backup> {
  const target = mode === 'merge' ? mergeBackup(current, incoming.backup) : incoming.backup;
  const localIds = new Set(current.data.tasks.map(task => task.id));
  const imported = target.data.tasks.filter(task => mode === 'replace' || !localIds.has(task.id));
  const mapping = new Map<string, string>();
  const staged: Array<{ id: string; blob: Blob }> = [];
  const mapFile = (file: LocalFile): LocalFile => {
    let id = mapping.get(file.id);
    if (!id) {
      id = crypto.randomUUID();
      mapping.set(file.id, id);
      const bytes = incoming.files.get(file.id);
      if (!bytes) throw Error('Arquivo validado ausente.');
      staged.push({ id, blob: new Blob([new Uint8Array(bytes).buffer], { type: file.type }) });
    }
    return { ...file, id };
  };
  const importedIds = new Set(imported.map(task => task.id));
  const result: Backup = {
    ...target,
    data: {
      ...target.data,
      tasks: target.data.tasks.map(task =>
        importedIds.has(task.id)
          ? {
              ...task,
              files: task.files?.map(mapFile),
              slices: task.slices.map(slice => ({ ...slice, files: slice.files?.map(mapFile) })),
            }
          : task,
      ),
    },
  };
  await stageLocalFiles(staged);
  try {
    await persist(result);
  } catch (error) {
    await finishLocalFiles(
      staged.map(file => file.id),
      false,
    );
    throw error;
  }
  // Pending entries already expose their Blob; cleanup can be retried without losing committed data.
  await finishLocalFiles(
    staged.map(file => file.id),
    true,
  ).catch(() => {});
  return result;
}
