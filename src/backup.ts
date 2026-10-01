import type { Data, HistoryEntry, Task } from './main';
import type { FocusBlocking } from './focusBlocking';
import type { WeeklyPlan } from './schedule';
import { APP_VERSION } from './appVersion.ts';
import { MAX_LOCAL_FILE_BYTES, type LocalFile } from './localFiles.ts';
import { normalizeDomain } from './focusBlocking.ts';

export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;

export type Backup = {
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  timeZone: string;
  data: Pick<
    Data,
    'tasks' | 'history' | 'weeklyPlans' | 'breakPreferences' | 'wipLimits' | 'breakDurations' | 'areas'
  > & {
    focusBlocking: FocusBlocking;
    soundEnabled: boolean;
  };
};

const obj = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Registro inválido no arquivo de backup.');
  return value as Record<string, unknown>;
};
const str = (value: unknown, max = 4000): string => {
  if (typeof value !== 'string' || value.length > max) throw Error('Texto inválido no arquivo de backup.');
  return value;
};
const num = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw Error('Número inválido no arquivo de backup.');
  return value;
};
const list = (value: unknown, limit = 50_000): unknown[] => {
  if (!Array.isArray(value) || value.length > limit) throw Error('Lista inválida ou grande demais no backup.');
  return value;
};
const optional = <T>(value: unknown, read: (v: unknown) => T) =>
  value === undefined || value === null ? undefined : read(value);
const date = (value: unknown) => {
  const day = str(value, 10);
  const parsed = Date.parse(`${day}T12:00:00Z`);
  if (
    day &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(parsed) ||
      new Date(parsed).toISOString().slice(0, 10) !== day)
  )
    throw Error('Data inválida no backup.');
  return day;
};
const identifier = (value: unknown) => {
  const key = str(value, 120);
  if (!key) throw Error('Identificador vazio no backup.');
  return key;
};
const uniqueIds = <T extends { id: string }>(items: T[]) => {
  if (new Set(items.map(item => item.id)).size !== items.length)
    throw Error('O backup contém identificadores duplicados.');
  return items;
};
function readAttachment(value: unknown) {
  const link = obj(value);
  const url = str(link.url, 2000);
  if (!url.startsWith('https://')) throw Error('URL de anexo inválida no backup.');
  return {
    title: str(link.title, 200),
    url,
    reason: str(link.reason, 500),
    verifiedAt: link.verifiedAt == null ? null : num(link.verifiedAt),
    pageTitle: optional(link.pageTitle, v => str(v, 180)),
    description: optional(link.description, v => str(v, 360)),
    source: optional(link.source, v => str(v, 100)),
    summary: optional(link.summary, v => str(v, 600)),
  };
}

function readFiles(value: unknown): LocalFile[] | undefined {
  return optional(value, v =>
    uniqueIds(
      list(v, 100).map(entry => {
        const file = obj(entry);
        const id = identifier(file.id);
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('Identificador de arquivo inválido.');
        const size = num(file.size, 1, MAX_LOCAL_FILE_BYTES);
        if (!Number.isInteger(size)) throw Error('Tamanho de arquivo inválido.');
        return { id, name: str(file.name, 180), type: str(file.type, 100), size, addedAt: num(file.addedAt) };
      }),
    ),
  );
}

function readTask(value: unknown, includeFiles = false): Task {
  const t = obj(value);
  const column = str(t.column, 12);
  if (!['todo', 'doing', 'late', 'done'].includes(column)) throw Error('Coluna inválida no backup.');
  const difficulty = num(t.difficulty, 1, 3);
  if (!Number.isInteger(difficulty)) throw Error('Dificuldade inválida no backup.');
  const slices = uniqueIds(
    list(t.slices, 1000).map(value => {
      const slice = obj(value);
      if (typeof slice.done !== 'boolean') throw Error('Slice inválido no backup.');
      return {
        id: identifier(slice.id),
        name: str(slice.name, 140),
        done: slice.done,
        estimateMinutes: optional(slice.estimateMinutes, v => num(v, 1, 480)),
        notes: optional(slice.notes, v => str(v, 20_000)),
        ...(includeFiles ? { files: readFiles(slice.files) } : {}),
      };
    }),
  );
  const attachments = optional(t.attachments, v => list(v, 100).map(readAttachment));
  return {
    id: identifier(t.id),
    name: str(t.name, 300),
    description: str(t.description, 20_000),
    difficulty: difficulty as Task['difficulty'],
    skill: optional(t.skill, v => str(v, 50)),
    estimate: num(t.estimate, 1, 480),
    deadline: date(t.deadline),
    column: column as Task['column'],
    failures: num(t.failures),
    focusSeconds: num(t.focusSeconds),
    slices,
    attachments,
    notes: optional(t.notes, v => str(v, 20_000)),
    ...(includeFiles ? { files: readFiles(t.files) } : {}),
    createdAt: optional(t.createdAt, v => num(v)),
    completedAt: optional(t.completedAt, v => num(v)),
    archivedAt: optional(t.archivedAt, v => num(v)),
    planId: optional(t.planId, identifier),
    occurrenceDate: optional(t.occurrenceDate, date),
  };
}

function readHistory(value: unknown): HistoryEntry {
  const h = obj(value);
  return {
    id: identifier(h.id),
    taskId: identifier(h.taskId),
    kind: str(h.kind, 60),
    seconds: num(h.seconds),
    at: num(h.at),
    sliceIds: list(h.sliceIds, 1000).map(identifier),
    cycleId: optional(h.cycleId, v => str(v, 120)),
  };
}

function readPlan(value: unknown): WeeklyPlan {
  const plan = obj(value);
  const difficulty = optional(plan.difficulty, v => num(v, 1, 3));
  const weekdays = list(plan.weekdays, 7).map(v => num(v, 0, 6));
  if (weekdays.some(v => !Number.isInteger(v))) throw Error('Dia de rotina inválido.');
  const startsOn = date(plan.startsOn);
  if (!startsOn) throw Error('Data de início da rotina ausente.');
  return {
    id: identifier(plan.id),
    name: str(plan.name, 300),
    estimate: num(plan.estimate, 1, 480),
    weekdays,
    startsOn,
    generatedDates: list(plan.generatedDates ?? [], 5000).map(date),
    endsOn: optional(plan.endsOn, date),
    description: optional(plan.description, v => str(v, 20_000)),
    difficulty: difficulty as WeeklyPlan['difficulty'],
    skill: optional(plan.skill, v => str(v, 50)),
    sliceNames: optional(plan.sliceNames, v => list(v, 1000).map(x => str(x, 140))),
    attachments: optional(plan.attachments, v => list(v, 100).map(readAttachment)),
  };
}

export function makeBackup(
  data: Data,
  focusBlocking: FocusBlocking,
  soundEnabled: boolean,
  includeFiles = false,
): Backup {
  const snapshot: Backup = {
    schemaVersion: BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    data: {
      tasks: data.tasks,
      history: data.history,
      weeklyPlans: data.weeklyPlans,
      breakPreferences: data.breakPreferences,
      wipLimits: data.wipLimits,
      breakDurations: data.breakDurations,
      areas: data.areas,
      focusBlocking,
      soundEnabled,
    },
  };
  // Re-parse our own export to strip unknown keys added by older versions.
  return parseBackup(JSON.stringify(snapshot), includeFiles);
}

export function parseBackup(text: string, includeFiles = false): Backup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw Error('Arquivo de backup acima de 16 MB.');
  let parsed: Record<string, unknown>;
  try {
    parsed = obj(JSON.parse(text));
  } catch {
    throw Error('O arquivo não é um JSON de backup válido.');
  }
  if (parsed.schemaVersion !== BACKUP_VERSION)
    throw Error('Versão do backup incompatível. Este aplicativo aceita apenas a versão 1.');
  const d = obj(parsed.data);
  const wip = obj(d.wipLimits);
  const breaks = obj(d.breakDurations);
  const blocking = obj(d.focusBlocking);
  const mode = str(blocking.mode, 10);
  if (!['off', 'gentle', 'strict', 'custom'].includes(mode)) throw Error('Perfil de bloqueio inválido.');
  if (typeof d.soundEnabled !== 'boolean') throw Error('Preferência de som inválida.');
  const backup: Backup = {
    schemaVersion: 1,
    appVersion: str(parsed.appVersion, 30),
    exportedAt: str(parsed.exportedAt, 40),
    timeZone: str(parsed.timeZone, 80),
    data: {
      tasks: uniqueIds(list(d.tasks).map(value => readTask(value, includeFiles))),
      history: uniqueIds(list(d.history).map(readHistory)),
      weeklyPlans: uniqueIds(list(d.weeklyPlans, 5000).map(readPlan)),
      breakPreferences: list(d.breakPreferences, 100).map(v => str(v, 80)),
      areas: [
        ...new Set(
          list(d.areas ?? [], 100)
            .map(v => str(v, 50).trim())
            .filter(Boolean),
        ),
      ],
      wipLimits: { doing: num(wip.doing, 1, 50), late: wip.late == null ? null : num(wip.late, 1, 50) },
      breakDurations: { short: num(breaks.short, 1, 120), long: num(breaks.long, 1, 120) },
      focusBlocking: {
        mode: mode as FocusBlocking['mode'],
        exceptions: list(blocking.exceptions, 1000).map(readDomain),
        customDomains: list(blocking.customDomains, 1000).map(readDomain),
      },
      soundEnabled: d.soundEnabled,
    },
  };
  const taskIds = new Set(backup.data.tasks.map(task => task.id));
  // Deleted schedules intentionally leave their already generated tasks intact.
  if (backup.data.history.some(entry => !taskIds.has(entry.taskId))) {
    throw Error('O backup contém eventos vinculados a tarefas ausentes.');
  }
  return backup;
}

function readDomain(value: unknown): string {
  const domain = str(value, 253);
  if (normalizeDomain(domain) !== domain) throw Error('Domínio inválido no backup.');
  return domain;
}

// A collision keeps the local record. The weekly occurrence ledger is merged to prevent duplicates.
export function mergeBackup(current: Backup, incoming: Backup): Backup {
  const localTasks = new Set(current.data.tasks.map(task => task.id));
  const localHistory = new Set(current.data.history.map(entry => entry.id));
  const plans = new Map(current.data.weeklyPlans.map(plan => [plan.id, plan]));
  for (const plan of incoming.data.weeklyPlans) {
    const old = plans.get(plan.id);
    plans.set(
      plan.id,
      old ? { ...old, generatedDates: [...new Set([...old.generatedDates, ...plan.generatedDates])] } : plan,
    );
  }
  return {
    ...current,
    data: {
      ...current.data,
      tasks: [...current.data.tasks, ...incoming.data.tasks.filter(task => !localTasks.has(task.id))],
      // A reused task ID can name different tasks on independent profiles. Its
      // imported events must never be attributed to the local task that wins.
      history: [
        ...current.data.history,
        ...incoming.data.history.filter(entry => !localHistory.has(entry.id) && !localTasks.has(entry.taskId)),
      ],
      weeklyPlans: [...plans.values()],
      areas: [...new Set([...current.data.areas, ...incoming.data.areas])],
    },
  };
}
