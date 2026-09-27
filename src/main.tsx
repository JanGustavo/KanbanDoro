import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { getAISettings, saveAISettings, AI_PROVIDERS, type AISettings, type AIProvider } from './aiSettings';
import { dateFromDay, isVisible, localDay, materializeToday, weekEnd, type ViewMode, type WeeklyPlan } from './schedule';
import Connections from './Connections';
import Statistics from './Statistics';
import NumberStepper from './NumberStepper';
import { GuidedTour, type TourStep } from './guidedTour';
import { focusBlockingDefault, type FocusBlocking } from './focusBlocking';
import FocusBlockingSettings from './FocusBlockingSettings';
import { completedCycleCount, elapsedCredit, extensionBudget, nextStepTiming, resumeAfterPause, stepDeadline, suggestedBreakMinutes } from './cycleRules';
import { makeBackup, mergeBackup, parseBackup, MAX_BACKUP_BYTES, type Backup } from './backup';

type Column = 'todo' | 'doing' | 'late' | 'done';
type Slice = { id: string; name: string; done: boolean; estimateMinutes?: number };
type Attachment = { title: string; url: string; verifiedAt: number | null; reason: string };
export type Task = {
  id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3;
  skill?: string;
  estimate: number;
  deadline: string;
  column: Column;
  failures: number;
  focusSeconds: number;
  slices: Slice[];
  attachments?: Attachment[];
  createdAt?: number;
  completedAt?: number;
  archivedAt?: number;
  planId?: string;
  occurrenceDate?: string;
};
type Session = {
  taskId: string;
  phase: 'running' | 'decision' | 'post-focus' | 'break' | 'break-done' | 'intermission' | 'intermission-done';
  startedAt: number;
  endsAt: number;
  originalMinutes: number;
  extensionMinutes: number;
  extensions: number;
  selectedSliceIds: string[];
  scope: 'whole' | 'slices';
  breakType: string;
  creditedSeconds: number;
  excludedSeconds: number;
  steps?: Array<{ taskId: string; minutes: number; finished: boolean; originalEstimate?: number }>;
  stepIndex?: number;
  stepStartedAt?: number;
  stepEndsAt?: number;
  pauseStartedAt?: number;
  pauseEndsAt?: number;
  warnedMinutes?: number[];
  postFocusCompleted?: boolean;
};
export type HistoryEntry = { id: string; taskId: string; kind: string; seconds: number; at: number; sliceIds: string[]; cycleId?: string };
type Proposal = { name: string; description: string; difficulty: 1 | 2 | 3; skill?: string; estimate: number; slices: string[]; attachments: Attachment[]; deadline?: string };
type ScheduleChoice = { mode: 'once' | 'selected-days' | 'weekly'; startDate: string; weekdays: number[] };
type AIModel = { id: string; name: string };
export type Data = { tasks: Task[]; session: Session | null; history: HistoryEntry[]; breakPreferences: string[]; weeklyPlans: WeeklyPlan[];
  wipLimits: { doing: number; late: number | null }; breakDurations: { short: number; long: number }; areas: string[] };
const columns: { id: Column; label: string }[] = [
  { id: 'todo', label: 'A fazer' }, { id: 'doing', label: 'Em andamento' },
  { id: 'late', label: 'Em atraso' }, { id: 'done', label: 'Concluído' },
];
const initial: Data = { tasks: [], session: null, history: [], breakPreferences: ['Descanso', 'Água', 'Comida', 'Detox'], weeklyPlans: [], wipLimits: { doing: 5, late: null }, breakDurations: { short: 5, long: 15 }, areas: ['Programação', 'Estudo', 'Escrita', 'Organização'] };
const id = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
const minutes = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
const loadingTips = [
  'Um ciclo de foco pode cobrir a tarefa inteira ou apenas alguns slices.',
  'Pausas também têm cronômetro. Escolha o tipo e a duração antes de começar.',
  'Cinco tarefas em andamento são o limite sugerido para manter o foco.',
  'O tempo registrado continua disponível quando você reabre o navegador.',
];
const tourSteps: TourStep[] = [
  { selector: '#tour-create', title: 'Comece por uma tarefa', description: 'Descreva o que quer fazer. Criar tarefa abre um formulário para revisar tempo, área e etapas antes de salvar.' },
  { selector: '#tour-ai', title: 'Peça uma proposta à IA', description: 'Depois de escrever a tarefa, a IA pode sugerir etapas, tempo e área. Você revisa tudo antes de salvar.' },
  { selector: '#tour-board', title: 'Veja o trabalho no quadro', description: 'Arraste tarefas entre colunas e abra um card para editar detalhes. Marque tarefas de A fazer ou Em andamento para montar o próximo ciclo.' },
  { selector: '#tour-views', title: 'Escolha o recorte', description: 'Alterne entre o dia, a semana, todas as tarefas, o arquivo e as estatísticas. O histórico permanece disponível.' },
  { selector: '#tour-tools', title: 'Organize seu ambiente', description: 'Filtre por área, ajuste o bloqueio de sites no Modo foco e programe tarefas semanais.' },
  { selector: '#tour-header-tools', title: 'Volte quando precisar', description: 'Abra a bolha do cronômetro, consulte Connections e configure pausas, IA e o quadro em Preferências.' },
];
const tourStorage = {
  get: async () => Boolean((await chrome.storage.local.get('kanbandoroTourSeenV1')).kanbandoroTourSeenV1),
  set: async (seen: boolean) => { await chrome.storage.local.set({ kanbandoroTourSeenV1: seen }); },
};
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const displayDate = (time?: number) => time ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(time) : 'Data anterior ao registro';
function newOccurrence(plan: WeeklyPlan, day: string): Task {
  return { id: id(), name: plan.name, description: plan.description ?? '', difficulty: plan.difficulty ?? 1, skill: plan.skill, estimate: plan.estimate, deadline: '', column: 'todo',
    failures: 0, focusSeconds: 0, slices: (plan.sliceNames ?? []).map(name => ({ id: id(), name, done: false, estimateMinutes: Math.max(1, Math.round(plan.estimate / Math.max(1, plan.sliceNames?.length ?? 1))) })),
    attachments: plan.attachments ?? [], planId: plan.id, occurrenceDate: day, createdAt: Date.now() };
}

function App() {
  const tourRef = useRef<GuidedTour | null>(null);
  const [data, setData] = useState<Data>(initial);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState('');
  const [sliceDraft, setSliceDraft] = useState('');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [scope, setScope] = useState<'whole' | 'slices'>('whole');
  const [selectedSlices, setSelectedSlices] = useState<string[]>([]);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [quickBreakMinutes, setQuickBreakMinutes] = useState(3);
  const [requestedExtension, setRequestedExtension] = useState(5);
  const [stepNotice, setStepNotice] = useState('');
  const [breakType, setBreakType] = useState('Descanso');
  const [error, setError] = useState('');
  const [restart, setRestart] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'breaks' | 'board' | 'ai' | 'data'>('breaks');
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [headerTab, setHeaderTab] = useState(0);
  const [wipHelp, setWipHelp] = useState(false);
  const [creatingArea, setCreatingArea] = useState(false);
  const [importPreview, setImportPreview] = useState<Backup | null>(null);
  const [backupError, setBackupError] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [savedBeforeImport, setSavedBeforeImport] = useState('');
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
  const [focusBlocking, setFocusBlocking] = useState<FocusBlocking | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettings>({ provider: '', apiKey: '', geminiApiKey: '', model: '', customEndpoint: '' });
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalSource, setProposalSource] = useState<'manual' | 'ai'>('manual');
  const [schedule, setSchedule] = useState<ScheduleChoice>({ mode: 'once', startDate: localDay(new Date()), weekdays: [1, 2, 3, 4, 5] });
  const [feedback, setFeedback] = useState('');
  const [proposalTab, setProposalTab] = useState<'details' | 'attachments'>('details');
  const [proposalRevision, setProposalRevision] = useState(0);
  const [checkingLink, setCheckingLink] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tipsDismissed, setTipsDismissed] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);
  const [toast, setToast] = useState('');
  const [undo, setUndo] = useState<{ kind: 'delete' | 'archive'; task: Task; history: HistoryEntry[]; message: string } | null>(null);
  const [view, setView] = useState<ViewMode>('today');
  const [skillFilter, setSkillFilter] = useState('');
  const [archiveDay, setArchiveDay] = useState('');
  const [cycleSelection, setCycleSelection] = useState<string[]>([]);
  const [cycleMinutes, setCycleMinutes] = useState<Record<string, number>>({});
  const [sliceInsight, setSliceInsight] = useState('');
  const [insightBusy, setInsightBusy] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['tasks', 'session', 'history', 'breakPreferences', 'weeklyPlans', 'wipLimits', 'breakDurations', 'areas']).then((stored) => {
      const tasks = (stored.tasks as Task[] | undefined) ?? [];
      const weeklyPlans = (stored.weeklyPlans as WeeklyPlan[] | undefined) ?? [];
      const generated = materializeToday(tasks, weeklyPlans, new Date(), newOccurrence);
      setData({ tasks: generated.tasks, weeklyPlans: generated.plans, session: (stored.session as Session | undefined) ?? null, history: (stored.history as HistoryEntry[] | undefined) ?? [], breakPreferences: (stored.breakPreferences as string[] | undefined) ?? initial.breakPreferences,
        wipLimits: (stored.wipLimits as Data['wipLimits'] | undefined) ?? initial.wipLimits, breakDurations: (stored.breakDurations as Data['breakDurations'] | undefined) ?? initial.breakDurations,
        areas: Array.isArray(stored.areas) ? (stored.areas as string[]).filter(area => typeof area === 'string') : initial.areas });
      setReady(true);
    });
    getAISettings().then(setAiSettings);
    chrome.storage.local.get(['soundEnabled', 'tipsDismissed']).then(stored => {
      setSoundEnabled(stored.soundEnabled !== false);
      setTipsDismissed(stored.tipsDismissed === true);
    });
    chrome.storage.local.get('focusBlocking').then(stored => setFocusBlocking((stored.focusBlocking as FocusBlocking | undefined) ?? focusBlockingDefault));
    const onSessionChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      const incoming = changes.session?.newValue as Session | undefined;
      if (area !== 'local' || incoming?.phase !== 'decision') return;
      setData(old => old.session?.phase === 'running' && old.session.startedAt === incoming.startedAt && old.session.taskId === incoming.taskId
        ? { ...old, session: incoming } : old);
    };
    chrome.storage.onChanged.addListener(onSessionChange);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const tips = window.setInterval(() => setTipIndex(i => (i + 1) % loadingTips.length), 6000);
    return () => { window.clearInterval(timer); window.clearInterval(tips); chrome.storage.onChanged.removeListener(onSessionChange); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => { setToast(current => current === toast ? '' : current); setUndo(current => current?.message === toast ? null : current); }, undo?.message === toast ? 8000 : 4500);
    return () => window.clearTimeout(timeout);
  }, [toast, undo]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.altKey || event.ctrlKey || event.metaKey || event.repeat || !ready || proposal || selectedTask || showSettings || showConnections) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      openManualDraft();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ready, proposal, selectedTask, showSettings, showConnections]);
  useEffect(() => {
    if (!stepNotice) return;
    const timeout = window.setTimeout(() => setStepNotice(''), 10_000);
    return () => window.clearTimeout(timeout);
  }, [stepNotice]);
  useEffect(() => {
    if (!wipHelp) return;
    const timeout = window.setTimeout(() => setWipHelp(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [wipHelp]);
  useEffect(() => {
    if (ready) void chrome.storage.local.set(data);
  }, [data, ready]);
  useEffect(() => {
    if (!ready) return;
    const tour = new GuidedTour({ steps: tourSteps, storage: tourStorage,
      onStart: () => { setTipsDismissed(true); void chrome.storage.local.set({ tipsDismissed: true }); },
      onComplete: () => setToast('Tutorial concluído. Você pode revê-lo pelo ícone ? no cabeçalho.'),
    });
    tourRef.current = tour;
    return () => { tour.destroy(); if (tourRef.current === tour) tourRef.current = null; };
  }, [ready]);
  function startTutorial() {
    setShowStatistics(false);
    setView('today');
    setShowSettings(false);
    setShowConnections(false);
    setShowFocusMode(false);
    window.requestAnimationFrame(() => { void tourRef.current?.start({ force: true }); });
  }
  function changeFocusBlocking(next: FocusBlocking) {
    setFocusBlocking(next);
    void chrome.storage.local.set({ focusBlocking: next });
  }
  function saveBackup(snapshot: Backup, prefix = 'kanbandoro-backup') {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prefix}-${snapshot.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  async function chooseBackup(file?: File) {
    setImportPreview(null);
    setBackupError('');
    setSavedBeforeImport('');
    setBackupAcknowledged(false);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) return setBackupError('Arquivo acima de 16 MB.');
    try { setImportPreview(parseBackup(await file.text())); }
    catch (err) { setBackupError(err instanceof Error ? err.message : 'Não foi possível ler o backup.'); }
  }
  async function restoreBackup(mode: 'merge' | 'replace') {
    if (!importPreview || backupBusy) return;
    if (data.session) return setBackupError('Encerre a sessão ou a pausa antes de restaurar um backup.');
    if (!backupAcknowledged || savedBeforeImport !== JSON.stringify({ data, focusBlocking, soundEnabled })) {
      return setBackupError('Exporte e confirme uma cópia atual do quadro antes de importar.');
    }
    if (mode === 'replace' && !window.confirm('Substituir tarefas, histórico, rotinas e preferências locais? Um backup do estado atual será baixado antes.')) return;
    setBackupBusy(true);
    setBackupError('');
    try {
      const current = makeBackup(data, focusBlocking ?? focusBlockingDefault, soundEnabled);
      const target = mode === 'merge' ? mergeBackup(current, importPreview) : importPreview;
      await chrome.storage.local.set({ ...target.data, session: null });
      window.location.reload();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Não foi possível restaurar o backup.');
      setBackupBusy(false);
    }
  }
  const today = localDay(new Date(now));
  useEffect(() => {
    if (ready) update(old => {
      const generated = materializeToday(old.tasks, old.weeklyPlans, new Date(), newOccurrence);
      return generated.tasks === old.tasks && generated.plans.every((plan, i) => plan === old.weeklyPlans[i]) ? old : { ...old, tasks: generated.tasks, weeklyPlans: generated.plans };
    });
  }, [today, ready]);
  useEffect(() => {
    if (ready && !data.breakPreferences.includes(breakType)) {
      setBreakType(data.breakPreferences[0] ?? 'Outra');
    }
  }, [data.breakPreferences, ready]);
  useEffect(() => {
    if (restart && !active) {
      startFocus(restart);
      setRestart(null);
    }
  }, [restart, data.session]);

  const update = (fn: (old: Data) => Data) => setData(old => fn(old));
  const task = data.tasks.find(t => t.id === selectedTask);
  const active = data.session;
  const activeTask = data.tasks.find(t => t.id === (active?.steps?.[active.stepIndex ?? 0]?.taskId ?? active?.taskId));
  const due = active && (active.phase === 'running' || active.phase === 'break' || active.phase === 'intermission') && now >= (active.phase === 'running' ? stepDeadline(active) : active.phase === 'intermission' ? active.pauseEndsAt ?? Infinity : active.endsAt);
  const phase = due ? (active?.phase === 'running' ? 'decision' : active?.phase === 'intermission' ? 'intermission-done' : 'break-done') : active?.phase;
  const stepRemaining = active && ['intermission', 'intermission-done'].includes(active.phase) ? stepDeadline(active) - (active.pauseStartedAt ?? now) : active?.phase === 'running' ? stepDeadline(active) - now : 0;
  const extensionRemaining = active ? extensionBudget(active.steps?.[active.stepIndex ?? 0]?.originalEstimate ?? activeTask?.estimate ?? active.originalMinutes, active.extensionMinutes, active.extensions) : 0;
  useEffect(() => {
    if (!ready || !data.session || data.session.phase !== 'running') return;
    const current = data.session;
    const remaining = stepDeadline(current) - now;
    if (remaining <= 0) {
      update(old => old.session?.startedAt === current.startedAt && old.session?.phase === 'running'
        ? { ...old, session: { ...old.session, phase: 'decision' } } : old);
      setStepNotice('');
      return;
    }
    const duration = stepDeadline(current) - (current.stepStartedAt ?? current.startedAt);
    const threshold = remaining <= 120_000 && duration > 120_000 ? 2 : remaining <= 300_000 && duration > 300_000 ? 5 : 0;
    if (!threshold || current.warnedMinutes?.includes(threshold)) return;
    update(old => old.session?.startedAt === current.startedAt && old.session?.taskId === current.taskId && old.session.phase === 'running'
      ? { ...old, session: { ...old.session, warnedMinutes: [...(old.session.warnedMinutes ?? []), ...(threshold === 2 ? [5, 2] : [5])] } } : old);
    setStepNotice(`Faltam ${threshold} minutos para decidir sobre ${activeTask?.name ?? 'a tarefa'}.`);
  }, [now, ready, data.session]);
  const doingCount = data.tasks.filter(t => t.column === 'doing' && !t.archivedAt).length;
  const lateCount = data.tasks.filter(t => t.column === 'late' && !t.archivedAt).length;
  const finishedCycles = completedCycleCount(data.history);
  const todayCycles = data.history.filter(entry => (entry.kind === 'cycle-completed' || (entry.kind === 'completed' && !entry.cycleId)) && localDay(new Date(entry.at)) === today).length;
  useEffect(() => {
    if (data.session?.phase === 'post-focus') setBreakMinutes(suggestedBreakMinutes(finishedCycles, !!data.session.postFocusCompleted, data.breakDurations));
  }, [data.session?.phase, finishedCycles, data.breakDurations.short, data.breakDurations.long]);
  const shownTasks = data.tasks.filter(t => isVisible(t, view, new Date(now), archiveDay)
    && (!skillFilter || (skillFilter === '__without_skill__' ? !t.skill?.trim() : t.skill?.trim() === skillFilter)));
  const skills = [...new Set([...data.areas, ...data.tasks.map(t => t.skill?.trim()).filter((skill): skill is string => !!skill)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const soonDate = dateFromDay(today);
  soonDate.setDate(soonDate.getDate() + 2);
  const soonDay = localDay(soonDate);
  const calendarDays = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(now);
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - (day.getDay() + 6) % 7 + offset);
    return day;
  });

  function changeTask(taskId: string, fn: (item: Task) => Task) {
    update(old => ({ ...old, tasks: old.tasks.map(item => {
      if (item.id !== taskId) return item;
      const next = fn(item);
      return next.column === item.column ? next : { ...next, completedAt: next.column === 'done' ? Date.now() : undefined, archivedAt: undefined };
    }) }));
  }
  function addTask(event: React.FormEvent) {
    event.preventDefault();
    openManualDraft(name);
  }
  function openManualDraft(title = '', recurring = false) {
    setError(''); setProposalSource('manual'); setProposalRevision(1); setProposalTab('details');
    setCreatingArea(false);
    setSchedule({ mode: recurring ? 'weekly' : 'once', startDate: localDay(new Date()), weekdays: [1, 2, 3, 4, 5] });
    setProposal({ name: title, description: '', difficulty: 1, estimate: 25, slices: [], attachments: [] });
  }
  function addArea(raw: string) {
    const area = raw.trim().slice(0, 50);
    if (!area || area === '__without_skill__') return;
    update(old => old.areas.some(existing => existing.toLocaleLowerCase() === area.toLocaleLowerCase()) ? old : { ...old, areas: [...old.areas, area] });
  }
  function draftFromConnection(draft: { name: string; description: string; deadline?: string }) {
    openManualDraft(draft.name);
    setProposal(previous => previous && ({ ...previous, description: draft.description, deadline: draft.deadline }));
    setName(draft.name);
    setShowConnections(false);
  }
  function deleteTask(item: Task) {
    if (active?.taskId === item.id || active?.steps?.some(step => step.taskId === item.id)) return setError('Encerre o ciclo atual antes de apagar esta tarefa.');
    if (!window.confirm(`Apagar “${item.name}” e seu histórico de foco? Você terá 8 segundos para desfazer.`)) return;
    const message = 'Tarefa e histórico removidos. A rotina semanal continua ativa.';
    setUndo({ kind: 'delete', task: item, history: data.history.filter(entry => entry.taskId === item.id), message });
    update(old => ({ ...old, tasks: old.tasks.filter(task => task.id !== item.id), history: old.history.filter(entry => entry.taskId !== item.id) }));
    setSelectedTask(null); setToast(message);
  }
  function archiveTask(item: Task) {
    if (item.column !== 'done') return setError('Conclua a tarefa antes de arquivar.');
    const message = 'Tarefa arquivada. Você pode desfazer agora ou encontrá-la no arquivo.';
    setUndo({ kind: 'archive', task: item, history: [], message });
    changeTask(item.id, task => ({ ...task, archivedAt: Date.now() }));
    setSelectedTask(null); setToast(message);
  }
  function undoLastAction() {
    if (!undo) return;
    if (undo.kind === 'archive') changeTask(undo.task.id, task => ({ ...task, archivedAt: undo.task.archivedAt }));
    else update(old => ({ ...old,
      tasks: old.tasks.some(task => task.id === undo.task.id) ? old.tasks : [...old.tasks, undo.task],
      history: [...old.history, ...undo.history.filter(entry => !old.history.some(existing => existing.id === entry.id))],
    }));
    setUndo(null); setToast('Ação desfeita.');
  }
  async function loadModels() {
    setAiBusy(true); setAiNotice('');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GROQ_MODELS' }) as { models?: AIModel[]; error?: string };
      if (response.error) throw Error(response.error);
      setModels(response.models ?? []);
      if (!response.models?.length) setAiNotice('Nenhum modelo compatível com propostas estruturadas foi encontrado.');
    } catch (reason) { setAiNotice(reason instanceof Error ? reason.message : 'Não foi possível consultar os modelos.'); }
    finally { setAiBusy(false); }
  }
  async function requestProposal(comment = '') {
    if (!name.trim()) return setError('Descreva a tarefa antes de pedir uma proposta.');
    setAiBusy(true); setError('');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GROQ_TASK_PROPOSAL', input: name, previous: proposal, feedback: comment, areas: skills.slice(0, 50) }) as { proposal?: Proposal; error?: string };
      if (response.error || !response.proposal) throw Error(response.error || 'A IA não retornou uma proposta.');
      setProposal({ ...response.proposal, skill: response.proposal.skill ?? proposal?.skill ?? '' }); setProposalSource('ai'); setFeedback(''); setProposalRevision(value => comment ? value + 1 : 1);
      if (!comment) setSchedule({ mode: 'once', startDate: localDay(new Date()), weekdays: [1, 2, 3, 4, 5] });
      if (!comment) setProposalTab('details');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'A IA não respondeu.'); }
    finally { setAiBusy(false); }
  }
  async function requestSliceInsight(item: Task) {
    if (!item.slices.length) return setSliceInsight('Adicione pelo menos um slice para receber uma análise.');
    setInsightBusy(true); setSliceInsight('');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'AI_SLICE_INSIGHT', task: { name: item.name, estimate: item.estimate,
        slices: item.slices.map(slice => ({ name: slice.name, estimateMinutes: slice.estimateMinutes ?? null })) } }) as { insight?: string; error?: string };
      if (response.error || !response.insight) throw Error(response.error || 'A IA não retornou uma sugestão.');
      setSliceInsight(response.insight);
    } catch (reason) { setSliceInsight(reason instanceof Error ? reason.message : 'Não foi possível analisar os slices.'); }
    finally { setInsightBusy(false); }
  }
  function changeAttachment(index: number, patch: Partial<Attachment>) {
    setProposal(old => old && ({ ...old, attachments: old.attachments.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  }
  async function verifyAttachment(index: number) {
    const originalUrl = proposal?.attachments[index]?.url;
    if (!originalUrl) return;
    setCheckingLink(index);
    try {
      const result = await chrome.runtime.sendMessage({ type: 'CHECK_ATTACHMENT', url: originalUrl }) as { check?: Omit<Attachment, 'title'>; error?: string };
      if (result.error || !result.check) throw Error(result.error || 'Não foi possível verificar o link.');
      setProposal(old => old && ({ ...old, attachments: old.attachments.map((item, i) => i === index && item.url === originalUrl ? { ...item, ...result.check } : item) }));
    } catch { changeAttachment(index, { verifiedAt: null, reason: 'Não foi possível verificar o link agora.' }); }
    finally { setCheckingLink(null); }
  }
  function acceptProposal() {
    if (!proposal?.name.trim() || !Number.isFinite(proposal.estimate) || proposal.estimate < 1 || proposal.estimate > 480) return setError('Revise o nome e o tempo estimado (1 a 480 minutos).');
    if (schedule.mode !== 'once') {
      const start = dateFromDay(schedule.startDate);
      const end = weekEnd(start);
      if (localDay(start) !== schedule.startDate || schedule.startDate < localDay(new Date()) || schedule.weekdays.length === 0) {
        return setError('Escolha uma data inicial a partir de hoje e ao menos um dia da semana.');
      }
      if (schedule.mode === 'selected-days' && !Array.from({ length: 7 }, (_, offset) => {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, 12);
        return localDay(day) <= end && schedule.weekdays.includes(day.getDay());
      }).some(Boolean)) return setError('Nesta semana não restam dias selecionados. Escolha outra data inicial ou outros dias.');
    }
    const attachments = proposal.attachments.filter(link => link.title.trim() && link.verifiedAt && Date.now() - link.verifiedAt < 10 * 60_000);
    if (proposal.skill?.trim()) addArea(proposal.skill);
    if (schedule.mode !== 'once') {
      const plan: WeeklyPlan = { id: id(), name: proposal.name.trim(), description: proposal.description, difficulty: proposal.difficulty, skill: proposal.skill?.trim().slice(0, 50),
        estimate: proposal.estimate, sliceNames: proposal.slices.filter(s => s.trim()).map(s => s.trim()), attachments,
        weekdays: [...schedule.weekdays].sort(), startsOn: schedule.startDate, generatedDates: [],
        endsOn: schedule.mode === 'selected-days' ? weekEnd(dateFromDay(schedule.startDate)) : undefined };
      update(old => {
        const generated = materializeToday(old.tasks, [...old.weeklyPlans, plan], new Date(), newOccurrence);
        return { ...old, tasks: generated.tasks, weeklyPlans: generated.plans };
      });
      setProposal(null); setName(''); setError(''); setWeeklyOpen(true);
      return setToast(schedule.mode === 'weekly' ? 'Tarefa programada para repetir toda semana.' : 'Tarefa programada apenas para os dias escolhidos desta semana.');
    }
    const item: Task = { id: id(), name: proposal.name.trim(), description: proposal.description, difficulty: proposal.difficulty, skill: proposal.skill?.trim().slice(0, 50), createdAt: Date.now(),
      estimate: proposal.estimate, deadline: proposal.deadline ?? '', column: 'todo', failures: 0, focusSeconds: 0,
      slices: proposal.slices.filter(s => s.trim()).map(s => ({ id: id(), name: s.trim(), done: false, estimateMinutes: Math.max(1, Math.round(proposal.estimate / Math.max(1, proposal.slices.filter(v => v.trim()).length))) })),
      attachments };
    update(old => ({ ...old, tasks: [...old.tasks, item] }));
    setProposal(null); setName(''); setSelectedTask(item.id);
    setToast('Proposta aceita. Só os anexos verificados foram salvos.');
  }
  function startFocus(item: Task) {
    return startFocusTasks([{ taskId: item.id, minutes: item.estimate }], item);
  }
  function startFocusTasks(steps: Array<{ taskId: string; minutes: number }>, item?: Task) {
    if (active) return setError('Encerre o ciclo ou descanso atual antes de iniciar outro.');
    if (item && scope === 'slices' && selectedSlices.length === 0) return setError('Escolha ao menos um slice.');
    if (!steps.length || steps.some(step => !Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > 480) || steps.reduce((sum, step) => sum + step.minutes, 0) > 480) return setError('O ciclo precisa de tarefas com duração total de até 480 min.');
    if (new Set(steps.map(step => step.taskId)).size !== steps.length || steps.some(step => !data.tasks.some(task => task.id === step.taskId && !task.archivedAt && (item ? task.column !== 'done' : ['todo', 'doing'].includes(task.column))))) return setError('Revise as tarefas selecionadas para o ciclo.');
    const t = Date.now();
    update(old => ({ ...old,
      tasks: old.tasks.map(x => steps.some(step => step.taskId === x.id) ? { ...x, column: 'doing' } : x),
      session: { taskId: steps[0].taskId, phase: 'running', startedAt: t, endsAt: t + steps.reduce((sum, step) => sum + step.minutes, 0) * 60000,
        originalMinutes: steps.reduce((sum, step) => sum + step.minutes, 0), extensionMinutes: 0, extensions: 0,
        steps: steps.map(step => ({ ...step, finished: false, originalEstimate: data.tasks.find(task => task.id === step.taskId)?.estimate ?? step.minutes })), stepIndex: 0, stepStartedAt: t, stepEndsAt: t + steps[0].minutes * 60000, warnedMinutes: [],
        scope: item ? scope : 'whole', selectedSliceIds: item && scope === 'slices' ? selectedSlices : [], breakType: '', creditedSeconds: 0, excludedSeconds: 0 },
    }));
    setCycleSelection([]);
    setError('');
    setToast('Ciclo iniciado. O cronômetro segue mesmo se você fechar o quadro.');
  }
  function credit(old: Data, kind: string): Data {
    const s = old.session;
    if (!s) return old;
    const total = elapsedCredit(s, Date.now());
    if (!total) return old;
    const entry: HistoryEntry = { id: id(), taskId: s.taskId, kind, seconds: total, at: Date.now(), sliceIds: s.selectedSliceIds, cycleId: s.steps ? String(s.startedAt) : undefined };
    return { ...old, tasks: old.tasks.map(t => t.id === s.taskId ? { ...t, focusSeconds: t.focusSeconds + total } : t),
      history: [...old.history, entry] };
  }
  function nextCycleTask(outcome: 'completed' | 'failed' = 'completed') {
    if (!active || !['running', 'decision'].includes(phase ?? '')) return;
    if (!active.steps) { setSelectedTask(null); return stopFocus(outcome); }
    if ((active.stepIndex ?? 0) >= active.steps.length - 1) { setSelectedTask(null); return stopFocus(outcome); }
    update(old => {
      const current = old.session;
      if (!current?.steps) return old;
      const credited = credit(old, outcome === 'failed' ? 'failed' : 'switched');
      const index = current.stepIndex ?? 0;
      const completed = credited.tasks.map(task => task.id !== current.taskId ? task : outcome === 'failed'
        ? { ...task, column: 'late' as Column, failures: task.failures + 1 }
        : { ...task, column: 'done' as Column, completedAt: Date.now() });
      const next = current.steps[index + 1];
      const time = Date.now();
      const timing = nextStepTiming(current, time, next.minutes);
      return { ...credited, tasks: completed, session: { ...current, steps: current.steps.map((step, i) => i === index ? { ...step, finished: true } : step), stepIndex: index + 1, taskId: next.taskId, scope: 'whole', selectedSliceIds: [],
        phase: 'running', ...timing, extensionMinutes: 0, extensions: 0, warnedMinutes: [] } };
    });
    setSelectedTask(null);
    setStepNotice('');
    setToast(outcome === 'failed' ? 'Tentativa falha registrada; próxima tarefa iniciada.' : 'Tarefa concluída; próxima tarefa iniciada.');
  }
  function extend(amount: number) {
    if (!active || phase !== 'decision') return;
    if (!Number.isInteger(amount) || amount < 1 || amount > extensionRemaining) return;
    update(old => {
      if (!old.session) return old;
      const waitingMs = Math.max(0, Date.now() - stepDeadline(old.session));
      return { ...old, session: { ...old.session, phase: 'running', stepEndsAt: Date.now() + amount * 60000,
        endsAt: old.session.endsAt + waitingMs + amount * 60000,
        excludedSeconds: (old.session.excludedSeconds ?? 0) + Math.floor(waitingMs / 1000),
        extensions: old.session.extensions + 1, extensionMinutes: old.session.extensionMinutes + amount, warnedMinutes: [] } };
    });
    setStepNotice('');
  }
  function pauseFocus() {
    if (!active || phase !== 'running' || stepDeadline(active) <= Date.now()) return;
    const started = Date.now();
    update(old => old.session?.phase === 'running' ? { ...old, session: { ...old.session, phase: 'intermission', pauseStartedAt: started,
      pauseEndsAt: started + quickBreakMinutes * 60_000 } } : old);
    setToast(`Foco pausado. Avisaremos após ${quickBreakMinutes} min; retome quando estiver pronto.`);
  }
  function resumeFocus() {
    if (!active || !['intermission', 'intermission-done'].includes(active.phase)) return;
    update(old => old.session ? { ...old, session: resumeAfterPause(old.session, Date.now()) } : old);
    setToast('Foco retomado. O tempo da pausa não entra na tarefa.');
  }
  function stopFocus(kind: 'completed' | 'failed' | 'interrupted') {
    if (!active) return;
    setToast(kind === 'completed' ? 'Escopo concluído. Registre uma pausa ou finalize o ciclo.' : kind === 'failed' ? 'Tentativa registrada. A tarefa foi movida para Em atraso.' : 'Ciclo interrompido. O tempo usado foi registrado.');
    update(old => {
      const credited = credit(old, kind);
      const tasks = credited.tasks.map(t => {
        if (t.id !== active.taskId) return t;
        const slices = kind === 'completed' && active.scope === 'slices'
          ? t.slices.map(s => active.selectedSliceIds.includes(s.id) ? { ...s, done: true } : s)
          : t.slices;
        const done = kind === 'completed' && (active.scope === 'whole' || (slices.length > 0 && slices.every(s => s.done)));
        return { ...t, slices, completedAt: done ? Date.now() : t.completedAt,
          column: kind === 'failed' ? 'late' as Column : done ? 'done' as Column : t.column,
          failures: t.failures + (kind === 'failed' ? 1 : 0) };
      });
      const completion = kind === 'completed' ? { ...credited, history: [...credited.history, { id: id(), taskId: active.taskId, kind: 'cycle-completed', seconds: 0, at: Date.now(), sliceIds: [], cycleId: String(active.startedAt) }] } : credited;
      return { ...completion, tasks, session: kind === 'completed' || kind === 'failed'
        ? { ...active, phase: 'post-focus', postFocusCompleted: kind === 'completed', creditedSeconds: Math.floor((Date.now() - active.startedAt) / 1000) }
        : null };
    });
  }
  function startBreak() {
    if (!active) return;
    const t = Date.now();
    update(old => ({ ...old, session: { ...active, phase: 'break', breakType, startedAt: t,
      endsAt: t + Math.max(1, breakMinutes) * 60000 } }));
    setToast(`Pausa de ${breakMinutes} min iniciada.`);
  }
  if (!ready) return <main className="loading" role="status"><h1>KanbanDoro</h1><p>Preparando seu quadro…</p><small>{loadingTips[tipIndex]}</small></main>;

  return <main className="shell">
    <header><div><span className="eyebrow">TRABALHO COM RITMO</span><h1><span className="brand-kanban">Kanban</span><span className="brand-doro">Doro</span></h1><p>Organize a tarefa. Dê tempo ao que importa.</p></div>
      <div className="header-actions">
        <div className="header-nav slide-tabs" id="tour-header-tools" aria-label="Ferramentas" style={{ '--tab-count': 3, '--active-index': headerTab } as React.CSSProperties}>
          <button onClick={() => { setHeaderTab(0); void chrome.runtime.sendMessage({ type: 'SHOW_TIMER' }); }}>Bolha</button>
          <button onClick={() => { setHeaderTab(1); setShowConnections(true); }}>Connections</button>
          <button onClick={() => { setHeaderTab(2); setSettingsTab('breaks'); setShowSettings(true); }}>Preferências</button>
        </div>
        <button className="tour-launch" aria-label="Abrir tutorial" title="Rever o tutorial" onClick={startTutorial}>?</button>
        <span className="pomodoro-count" title="Ciclos de foco concluídos hoje">◷ {todayCycles} hoje</span>
        <div className="status">{active ? '● Ciclo ativo' : '○ Pronto para começar'}</div>
      </div>
    </header>
    {error && <p className="warning" role="alert">{error} <button onClick={() => setError('')}>Fechar</button></p>}
    {toast && <div className="toast" role="status">{toast}{undo?.message === toast && <button className="toast-undo" onClick={undoLastAction}>Desfazer</button>}<button aria-label="Dispensar aviso" onClick={() => { setToast(''); setUndo(null); }}>✕</button></div>}
    {wipHelp && <div className="toast wip-toast" role="status">WIP é a quantidade de tarefas abertas ao mesmo tempo. Se você escolher meta 2 e tiver 3 em andamento, o quadro avisa sem bloquear. Conclua ou reorganize antes de assumir outra.<button aria-label="Fechar dica WIP" onClick={() => setWipHelp(false)}>✕</button></div>}
    {showConnections && <Connections onClose={() => setShowConnections(false)} onDraft={draftFromConnection} />}
    {showFocusMode && <div className="backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowFocusMode(false); }}><section className="dialog" role="dialog" aria-modal="true" aria-label="Modo foco"><button className="close" onClick={() => setShowFocusMode(false)} aria-label="Fechar modo foco">✕</button><span className="eyebrow">MODO FOCO</span><h2>Sites que atrapalham o ciclo</h2><p className="settings-hint">O bloqueio funciona somente com o cronômetro em foco. Durante as pausas, a navegação fica liberada.</p><FocusBlockingSettings settings={focusBlocking} onChange={changeFocusBlocking} /></section></div>}
    {!tipsDismissed && data.tasks.length === 0 && <aside className="first-use" aria-label="Primeiros passos">
      <span className="eyebrow">PRIMEIROS PASSOS</span><p>Crie uma tarefa, ajuste o tempo e os slices nos detalhes e inicie seu primeiro ciclo de foco.</p>
      <button className="first-use-tour" onClick={startTutorial}>Ver tutorial</button>
      <button onClick={() => { setTipsDismissed(true); void chrome.storage.local.set({ tipsDismissed: true }); }}>Entendi</button>
    </aside>}
    {active && <section className="focus" aria-label="Ciclo atual">
      <div className="focus-top"><span className="focus-lights" aria-hidden="true"><i /><i /><i /></span><span>KANBANDORO / CICLO ATUAL</span><span className="focus-state">● {phase?.startsWith('intermission') ? 'PAUSA RÁPIDA' : phase === 'break' || phase === 'break-done' ? 'EM PAUSA' : phase === 'running' ? 'EM FOCO' : 'AGUARDANDO VOCÊ'}</span></div>
      <div className="focus-content"><div className="focus-task"><div className="focus-task-heading"><span>{phase === 'break' || phase === 'break-done' ? active.breakType : 'SEU PRÓXIMO PASSO'}</span><span>{active.originalMinutes + active.extensionMinutes} MIN</span></div>
        <h2>{activeTask?.name ?? 'Tarefa removida'}</h2><p>{activeTask?.description || (active.scope === 'whole' ? 'Tarefa inteira' : `${active.selectedSliceIds.length} slices · tempo compartilhado`)}</p>
        {!!active.steps && <p className="cycle-step-summary">Tarefa {(active.stepIndex ?? 0) + 1} de {active.steps.length} · {active.steps[active.stepIndex ?? 0].minutes} min reservados inicialmente · tempo restante nesta tarefa: {minutes(Math.ceil(Math.max(0, stepRemaining) / 1000))}</p>}
        {stepNotice && phase === 'running' && <p className="step-notice" role="status">{stepNotice}</p>}
        {!!activeTask?.slices.length && <div className="focus-slices" aria-label="Etapas da tarefa">{activeTask.slices.map(slice => <span className={slice.done ? 'finished' : ''} key={slice.id}>{slice.name}{slice.done ? ' ✓' : ''}</span>)}</div>}</div>
      <div className="focus-progress"><div className="focus-ring" style={{ '--ring-progress': `${Math.min(100, Math.max(0, (((phase?.startsWith('intermission') ? active.pauseStartedAt ?? now : now) - active.startedAt) / Math.max(1, active.endsAt - active.startedAt)) * 100))}%` } as React.CSSProperties}><div><small>{phase?.startsWith('intermission') ? 'PAUSA RÁPIDA' : phase === 'break' || phase === 'break-done' ? 'PAUSA' : 'FOCO'}</small><strong className="clock">{phase === 'decision' || phase === 'break-done' || phase === 'intermission-done' ? '00:00' : minutes(Math.ceil((((phase === 'intermission' ? active.pauseEndsAt : active.endsAt) ?? now) - now) / 1000))}</strong><span>{phase?.startsWith('intermission') ? 'restantes da pausa' : 'do ciclo atual'}</span></div></div>
        <div className="focus-next"><span className="eyebrow">EM SEGUIDA</span><strong>{phase === 'running' ? 'Continue do ponto em que parou.' : phase === 'break' ? 'Aproveite sua pausa.' : 'Escolha o próximo passo.'}</strong><p>{active.scope === 'whole' ? 'Tempo associado à tarefa inteira.' : `Tempo compartilhado entre ${active.selectedSliceIds.length} slices.`}</p><div className="focus-progress-line"><span style={{ width: `${activeTask?.slices.length ? (activeTask.slices.filter(slice => slice.done).length / activeTask.slices.length) * 100 : 0}%` }} /></div><small>{activeTask?.slices.filter(slice => slice.done).length ?? 0} DE {activeTask?.slices.length ?? 0} ETAPAS CONCLUÍDAS</small></div></div></div>
      <div className="focus-actions">
        {phase === 'running' && <><button onClick={() => (active.stepIndex ?? 0) < (active.steps?.length ?? 1) - 1 ? nextCycleTask() : stopFocus('completed')}>{(active.stepIndex ?? 0) < (active.steps?.length ?? 1) - 1 ? 'Concluir tarefa e avançar ↗' : 'Concluir tarefa e ciclo'}</button><label>Pausa rápida (min) <NumberStepper label="Minutos da pausa rápida" value={quickBreakMinutes} min={1} max={30} onChange={setQuickBreakMinutes} /></label><button onClick={pauseFocus}>Pausar foco</button><button onClick={() => stopFocus('interrupted')}>Interromper e deixar para depois</button><button onClick={() => { stopFocus('interrupted'); if (activeTask) setRestart(activeTask); }}>Interromper e recomeçar</button></>}
        {phase?.startsWith('intermission') && <><span role="status">{phase === 'intermission-done' ? 'A pausa rápida terminou. Seu foco continua parado.' : 'Tempo da tarefa congelado; retome quando voltar.'}</span><button className="primary" onClick={resumeFocus}>Retomar foco</button></>}
        {phase === 'post-focus' && <>
          <span className="break-recommendation">{active.postFocusCompleted && finishedCycles > 0 && finishedCycles % 4 === 0 ? 'Quarto ciclo concluído: pausa longa sugerida.' : 'Pausa curta sugerida.'}</span>
          <label>Pausa <select value={breakType} onChange={e => setBreakType(e.target.value)}>{[...data.breakPreferences, 'Outra'].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          <label>min <NumberStepper label="Minutos da pausa" value={breakMinutes} min={1} max={120} onChange={setBreakMinutes} /></label>
          <button onClick={startBreak}>Iniciar pausa</button><button onClick={() => update(old => ({ ...old, session: null }))}>Finalizar ciclo</button></>}
        {phase === 'break' && <button onClick={() => update(old => ({ ...old, session: null }))}>Encerrar pausa</button>}
        {phase === 'break-done' && <><span role="status">Pausa encerrada. Confirme antes de voltar ao foco.</span><button onClick={() => update(old => ({ ...old, session: null }))}>Entendi</button></>}
      </div>
    </section>}
    {active && phase === 'decision' && <div className="backdrop cycle-decision-backdrop"><section className="dialog cycle-decision" role="dialog" aria-modal="true" aria-label="Tempo reservado encerrado">
      <span className="eyebrow">TEMPO DA TAREFA ENCERRADO</span><h2>{activeTask?.name ?? 'Tarefa atual'}</h2><p>O relógio está pausado. Confirme sua decisão para continuar o ciclo.</p>
      <div className="cycle-decision-actions"><button className="primary" onClick={() => (active.stepIndex ?? 0) < (active.steps?.length ?? 1) - 1 ? nextCycleTask() : stopFocus('completed')}>Concluí e avançar</button>
        {extensionRemaining > 0 && <label>Extensão (min) <NumberStepper label="Minutos da extensão" value={Math.min(Math.max(1, requestedExtension), extensionRemaining)} min={1} max={extensionRemaining} onChange={setRequestedExtension} /><button onClick={() => extend(Math.min(Math.max(1, requestedExtension), extensionRemaining))}>Estender ({active.extensions}/2)</button></label>}
        <button onClick={() => { setSelectedTask(active.taskId); setScope(active.scope); setSelectedSlices(active.selectedSliceIds); }}>Abrir detalhes</button></div>
    </section></div>}
    <form className="create" id="tour-create" onSubmit={addTask}><input aria-label="Nome da tarefa" placeholder="Qual é a próxima tarefa?" value={name} onChange={e => setName(e.target.value)} /><button type="submit">+ Criar tarefa</button><button className="ai-propose" id="tour-ai" type="button" disabled={aiBusy || !name.trim()} onClick={() => void requestProposal()}>{aiBusy ? 'Consultando…' : '✦ Propor com IA'}</button></form>
    {proposal && <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setProposal(null); }}><section key={proposalRevision} className="dialog proposal-dialog" role="dialog" aria-modal="true" aria-label={proposalSource === 'ai' ? 'Revisar proposta da IA' : 'Criar tarefa'}>
      <header className="proposal-header"><span className="proposal-spark" aria-hidden="true">{proposalSource === 'ai' ? 'ϟ' : '+'}</span><div><span className="eyebrow">{proposalSource === 'manual' ? 'CRIAR TAREFA' : proposalRevision > 1 ? 'PROPOSTA ATUALIZADA' : 'NOVA PROPOSTA'}</span><h2>{proposalSource === 'manual' ? 'Uma tarefa do seu jeito' : proposalRevision > 1 ? 'Uma nova versão para você' : 'Uma ideia para começar'}</h2><p>Defina as etapas e escolha quando ela deve aparecer.</p></div><button className="close" onClick={() => setProposal(null)} aria-label="Fechar proposta">✕</button></header>
      {error && <p className="warning" role="alert">{error}</p>}
      <div className="proposal-tabs slide-tabs" role="tablist" aria-label="Conteúdo da proposta" style={{ '--tab-count': 2, '--active-index': proposalTab === 'details' ? 0 : 1 } as React.CSSProperties}><button role="tab" aria-selected={proposalTab === 'details'} onClick={() => setProposalTab('details')}>Tarefa e etapas</button><button role="tab" aria-selected={proposalTab === 'attachments'} onClick={() => setProposalTab('attachments')}>Anexos <span>{proposal.attachments.length}</span></button></div>
      {proposalTab === 'details' ? <div className="proposal-pane">
      <label>Nome <input className="task-name" value={proposal.name} onChange={e => setProposal({ ...proposal, name: e.target.value })} /></label>
      <label>Descrição <textarea value={proposal.description} onChange={e => setProposal({ ...proposal, description: e.target.value })} /></label>
      <div className="fields"><label className="highlight-time">Tempo sugerido (min) <NumberStepper label="Tempo estimado da tarefa" value={proposal.estimate} min={1} max={480} onChange={estimate => setProposal({ ...proposal, estimate })} /></label>
      <label>Dificuldade <select value={proposal.difficulty} onChange={e => setProposal({ ...proposal, difficulty: +e.target.value as 1 | 2 | 3 })}><option value="1">1 · leve</option><option value="2">2 · média</option><option value="3">3 · alta</option></select></label></div>
      <label>Habilidade ou área (opcional) <select value={creatingArea ? '__new_area__' : proposal.skill ?? ''} onChange={event => { if (event.target.value === '__new_area__') { setCreatingArea(true); setProposal({ ...proposal, skill: '' }); } else { setCreatingArea(false); setProposal({ ...proposal, skill: event.target.value }); } }}><option value="">Sem área</option>{skills.map(area => <option key={area} value={area}>{area}</option>)}{proposal.skill && !skills.includes(proposal.skill) && !creatingArea && <option value={proposal.skill}>✦ Sugestão nova: {proposal.skill}</option>}<option value="__new_area__">+ Criar nova área…</option></select>{creatingArea && <input autoFocus maxLength={50} placeholder="Nome da nova área" value={proposal.skill ?? ''} onChange={event => setProposal({ ...proposal, skill: event.target.value })} />}{proposal.skill && !skills.includes(proposal.skill) && <small>Nova área: será adicionada quando você criar a tarefa.</small>}</label>
      <h3>Slices sugeridos</h3>{proposal.slices.map((slice, index) => <div className="proposal-slice" key={index}><input aria-label={`Slice ${index + 1}`} value={slice} onChange={e => setProposal({ ...proposal, slices: proposal.slices.map((s, i) => i === index ? e.target.value : s) })} /><button onClick={() => setProposal({ ...proposal, slices: proposal.slices.filter((_, i) => i !== index) })} aria-label={`Remover slice ${index + 1}`}>✕</button></div>)}
      <button onClick={() => setProposal({ ...proposal, slices: [...proposal.slices, ''] })}>+ Slice</button>
      </div> : <div className="proposal-pane"><p className="attachment-hint">Links úteis para a tarefa. Um link verificado respondeu agora; a disponibilidade e o conteúdo da página podem mudar.</p>
        {proposal.attachments.length === 0 && <p className="attachment-empty">Nenhum link sugerido. Você pode adicionar um endereço e verificá-lo.</p>}
        {proposal.attachments.map((link, index) => <div className="attachment-card" key={index}>
          <label>Título <input value={link.title} onChange={e => changeAttachment(index, { title: e.target.value })} /></label>
          <label>Endereço HTTPS <input type="url" value={link.url} onChange={e => changeAttachment(index, { url: e.target.value, verifiedAt: null, reason: 'Verifique o endereço após editar.' })} /></label>
          <div className="attachment-meta"><span className={link.verifiedAt ? 'link-ok' : 'link-pending'}>{link.verifiedAt ? '✓ Link respondeu' : link.reason || 'Link ainda não verificado'}</span><button disabled={checkingLink !== null} onClick={() => void verifyAttachment(index)}>{checkingLink === index ? 'Verificando…' : 'Verificar link'}</button><button aria-label={`Remover anexo ${index + 1}`} onClick={() => setProposal({ ...proposal, attachments: proposal.attachments.filter((_, i) => i !== index) })}>Remover</button></div>
          {link.verifiedAt && <a href={link.url} target="_blank" rel="noopener noreferrer">Abrir página ↗</a>}
        </div>)}
        <button onClick={() => setProposal({ ...proposal, attachments: [...proposal.attachments, { title: '', url: '', verifiedAt: null, reason: 'Informe um endereço para verificar.' }] })}>+ Adicionar link</button>
      </div>}
      <fieldset className="schedule-choice"><legend>Quando criar?</legend><div className="schedule-modes">
        <label><input type="radio" name="schedule-mode" checked={schedule.mode === 'once'} onChange={() => setSchedule(old => ({ ...old, mode: 'once' }))} /> Uma vez</label>
        <label><input type="radio" name="schedule-mode" checked={schedule.mode === 'selected-days'} onChange={() => setSchedule(old => ({ ...old, mode: 'selected-days' }))} /> Só na semana escolhida</label>
        <label><input type="radio" name="schedule-mode" checked={schedule.mode === 'weekly'} onChange={() => setSchedule(old => ({ ...old, mode: 'weekly' }))} /> Toda semana</label>
      </div>{schedule.mode !== 'once' && <div className="schedule-days"><label>Começar em <input type="date" min={today} value={schedule.startDate} onChange={e => setSchedule(old => ({ ...old, startDate: e.target.value }))} /></label>
        <div className="weekdays" role="group" aria-label="Dias de repetição">{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={schedule.weekdays.includes(index)} onChange={() => setSchedule(old => ({ ...old, weekdays: old.weekdays.includes(index) ? old.weekdays.filter(d => d !== index) : [...old.weekdays, index] }))} />{day}</label>)}</div>
        <small>{schedule.mode === 'selected-days' ? `Termina no domingo ${schedule.startDate ? weekEnd(dateFromDay(schedule.startDate)).split('-').reverse().join('/') : ''}. Depois não se repete.` : 'Uma nova tarefa aparece nos dias escolhidos, a cada semana.'}</small>
      </div>}</fieldset>
      {proposalSource === 'ai' && <label className="revision-label">Quer mudar algo? <textarea placeholder="Ex.: reduza o tempo e separe o backend em duas etapas" value={feedback} onChange={e => setFeedback(e.target.value)} /></label>}
      <div className="proposal-actions"><button className="reject" onClick={() => { setProposal(null); setFeedback(''); }}>{proposalSource === 'ai' ? 'Rejeitar' : 'Cancelar'}</button>{proposalSource === 'ai' && <button disabled={aiBusy || !feedback.trim()} onClick={() => void requestProposal(feedback)}>Reescrever com IA</button>}<button className="accept" disabled={aiBusy} onClick={acceptProposal}>{schedule.mode === 'once' ? 'Criar tarefa' : 'Criar programação'}</button></div>
    </section></div>}
    {showSettings && <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowSettings(false); }}><section className="dialog" role="dialog" aria-modal="true" aria-label="Preferências">
      <button className="close" onClick={() => setShowSettings(false)}>✕</button><span className="eyebrow">PREFERÊNCIAS</span>
      <div className="settings-tabs slide-tabs" role="tablist" style={{ '--tab-count': 4, '--active-index': settingsTab === 'breaks' ? 0 : settingsTab === 'board' ? 1 : settingsTab === 'ai' ? 2 : 3 } as React.CSSProperties}>
        <button role="tab" aria-selected={settingsTab === 'breaks'} onClick={() => setSettingsTab('breaks')}>Pausas</button>
        <button role="tab" aria-selected={settingsTab === 'board'} onClick={() => setSettingsTab('board')}>Quadro</button>
        <button role="tab" aria-selected={settingsTab === 'ai'} onClick={() => setSettingsTab('ai')}>IA</button>
        <button role="tab" aria-selected={settingsTab === 'data'} onClick={() => setSettingsTab('data')}>Dados</button>
      </div>
      {settingsTab === 'breaks' && (
        <>
          <label className="sound-option"><input type="checkbox" checked={soundEnabled} onChange={e => { setSoundEnabled(e.target.checked); void chrome.storage.local.set({ soundEnabled: e.target.checked }); }} /> Tocar aviso ao terminar foco ou pausa</label>
          <div className="fields"><label>Pausa curta (min) <NumberStepper label="Duração da pausa curta" value={data.breakDurations.short} min={1} max={120} onChange={short => update(old => ({ ...old, breakDurations: { ...old.breakDurations, short } }))} /></label>
          <label>Pausa longa após 4 ciclos (min) <NumberStepper label="Duração da pausa longa" value={data.breakDurations.long} min={1} max={120} onChange={long => update(old => ({ ...old, breakDurations: { ...old.breakDurations, long } }))} /></label></div>
          <h3>Categorias de pausa</h3>
          <ul className="break-prefs-list">
            {data.breakPreferences.map(pref => <li key={pref}><span>{pref}</span> <button onClick={() => update(old => ({ ...old, breakPreferences: old.breakPreferences.filter(p => p !== pref) }))}>Remover</button></li>)}
          </ul>
          <form onSubmit={e => { e.preventDefault(); const val = new FormData(e.currentTarget).get('pref') as string; if (val && !data.breakPreferences.includes(val)) update(old => ({ ...old, breakPreferences: [...old.breakPreferences, val] })); e.currentTarget.reset(); }} className="add-slice">
            <input name="pref" placeholder="Nova categoria de pausa" />
            <button>Adicionar</button>
          </form>
        </>
      )}
      {settingsTab === 'board' && <><h3>Limite orientativo de tarefas</h3><p className="settings-hint">O WIP indica quantas tarefas você mantém em andamento. O limite só avisa; você continua livre para mover tarefas. <button type="button" className="inline-help" onClick={() => setWipHelp(true)}>Como funciona?</button></p>
        <div className="wip-presets" aria-label="Metas de WIP"><button onClick={() => update(old => ({ ...old, wipLimits: { ...old.wipLimits, doing: 2 } }))}>Foco leve · 2</button><button onClick={() => update(old => ({ ...old, wipLimits: { ...old.wipLimits, doing: 5 } }))}>Equilibrado · 5</button><button onClick={() => update(old => ({ ...old, wipLimits: { ...old.wipLimits, doing: 8 } }))}>Mais frentes · 8</button></div>
        <div className="fields"><label>Em andamento <NumberStepper label="Limite de tarefas em andamento" value={data.wipLimits.doing} min={1} max={50} onChange={doing => update(old => ({ ...old, wipLimits: { ...old.wipLimits, doing } }))} /></label>
        <label>Em atraso (0 desliga o aviso) <NumberStepper label="Limite de tarefas em atraso" value={data.wipLimits.late ?? 0} min={0} max={50} onChange={late => update(old => ({ ...old, wipLimits: { ...old.wipLimits, late: late || null } }))} /></label></div>
        <h3>Áreas de trabalho</h3><p className="settings-hint">Organize o quadro por área. A IA vê esses nomes ao propor uma tarefa e pode sugerir outra, sempre sujeita à sua aprovação.</p>
        <div className="area-list">{data.areas.map(area => <span key={area}>{area} <button aria-label={`Remover área ${area}`} onClick={() => update(old => ({ ...old, areas: old.areas.filter(name => name !== area) }))}>×</button></span>)}</div>
        <form className="add-slice" onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('area') as HTMLInputElement; addArea(input.value); input.value = ''; }}><input name="area" maxLength={50} placeholder="Nova área, ex.: Design" aria-label="Nome da nova área" /><button>Adicionar área</button></form>
      </>}
      {settingsTab === 'ai' && (
        <>
          <h3>Assistência de IA</h3>
          <p className="settings-hint">Escolha Groq ou Gemini, salve a chave específica do provedor e consulte os modelos disponíveis na sua conta. As chaves ficam separadas neste navegador.</p>
          <div className="ai-settings-form">
            <label>
              Provedor
              <select value={aiSettings.provider} onChange={e => { setModels([]); setAiSettings((s: AISettings) => ({ ...s, provider: e.target.value as AIProvider, model: '', customEndpoint: '' })); }}>
                <option value="">Selecionar provedor</option>
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => <option key={key} value={key} disabled={!['groq', 'gemini'].includes(key)}>{provider}{!['groq', 'gemini'].includes(key) ? ' · em breve' : ''}</option>)}
              </select>
            </label>
                {aiSettings.provider && (
              <>
                <label>
                  Modelo
                  {['groq', 'gemini'].includes(aiSettings.provider) ? <><select value={aiSettings.model} onChange={e => setAiSettings(s => ({ ...s, model: e.target.value }))}><option value="">{models.length ? 'Selecione um modelo' : 'Consulte os modelos da sua conta'}</option>{models.map(model => <option key={model.id} value={model.id}>{model.name} ({model.id})</option>)}</select><button type="button" disabled={aiBusy} onClick={() => void loadModels()}>Atualizar modelos</button></> : <input value={aiSettings.model} onChange={e => setAiSettings(s => ({ ...s, model: e.target.value }))} />}
                </label>
                {aiSettings.provider === 'custom' && (
                  <label>
                    Endpoint personalizado (OpenAI-compatível)
                    <input type="url" placeholder="https://api.exemplo.com/v1" value={aiSettings.customEndpoint} onChange={e => setAiSettings((s: AISettings) => ({ ...s, customEndpoint: e.target.value }))} />
                  </label>
                )}
                <label>
                  Chave da API
                  <div className="api-key-input">
                    <input
                      type={aiKeyVisible ? 'text' : 'password'}
                      placeholder={aiSettings.provider === 'gemini' ? 'Chave do Google AI Studio' : 'Chave da Groq'}
                      value={aiSettings.provider === 'gemini' ? aiSettings.geminiApiKey : aiSettings.apiKey}
                      onChange={e => setAiSettings((s: AISettings) => ({ ...s, [s.provider === 'gemini' ? 'geminiApiKey' : 'apiKey']: e.target.value }))}
                      autoComplete="off"
                    />
                    <button type="button" onClick={() => setAiKeyVisible(v => !v)} aria-label={aiKeyVisible ? 'Ocultar chave' : 'Mostrar chave'}>
                      {aiKeyVisible ? '🙈' : '👁'}
                    </button>
                  </div>
                </label>
                <div className="ai-actions">
                  <button className="primary" onClick={async () => { await saveAISettings(aiSettings); setAiNotice(aiSettings.model ? 'Modelo salvo. Já pode propor uma tarefa.' : 'Chave salva. Agora consulte os modelos e escolha um.'); }} disabled={!['groq', 'gemini'].includes(aiSettings.provider) || !(aiSettings.provider === 'gemini' ? aiSettings.geminiApiKey : aiSettings.apiKey)}>
                    Salvar chave e modelo
                  </button>
                  {(aiSettings.provider === 'gemini' ? aiSettings.geminiApiKey : aiSettings.apiKey) && (
                    <button className="danger" onClick={async () => { const next = { ...aiSettings, [aiSettings.provider === 'gemini' ? 'geminiApiKey' : 'apiKey']: '', model: '' }; await saveAISettings(next); setAiSettings(next); setAiNotice('Chave removida deste navegador.'); }}>
                      Remover chave
                    </button>
                  )}
                </div>
                {aiNotice && <p role="status">{aiNotice}</p>}
              </>
            )}
          </div>
        </>
      )}
      {settingsTab === 'data' && <section className="backup-panel" aria-label="Backup dos dados">
        <h3>Backup local</h3><p>Tarefas, slices, histórico, rotinas e preferências vão para o JSON. Chaves de IA, tokens Google e a sessão de foco ativa ficam fora.</p>
        <button disabled={backupBusy} onClick={() => { try { saveBackup(makeBackup(data, focusBlocking ?? focusBlockingDefault, soundEnabled)); setBackupError(''); } catch (err) { setBackupError(err instanceof Error ? err.message : 'Não foi possível exportar.'); } }}>Exportar JSON</button>
        <label>Escolher arquivo para prévia <input type="file" accept=".json,application/json" onChange={e => { void chooseBackup(e.target.files?.[0]); e.target.value = ''; }} /></label>
        {backupError && <p className="warning" role="alert">{backupError}</p>}
        {importPreview && <div className="backup-preview"><h4>Prévia · versão {importPreview.schemaVersion}</h4>
          <p>Exportado em {new Date(importPreview.exportedAt).toLocaleString('pt-BR')} ({importPreview.timeZone}).</p>
          <p>{importPreview.data.tasks.length} tarefas · {importPreview.data.history.length} eventos · {importPreview.data.weeklyPlans.length} rotinas.</p>
          <p>Ao mesclar, IDs repetidos preservam a tarefa local e descartam os eventos importados ligados a ela; datas de ocorrências semanais são reunidas. Substituir troca os dados locais. As credenciais atuais nunca são importadas.</p>
          <button type="button" onClick={() => { try { saveBackup(makeBackup(data, focusBlocking ?? focusBlockingDefault, soundEnabled), 'kanbandoro-antes-de-importar'); setSavedBeforeImport(JSON.stringify({ data, focusBlocking, soundEnabled })); setBackupAcknowledged(false); setBackupError(''); } catch (err) { setBackupError(err instanceof Error ? err.message : 'Não foi possível exportar.'); } }}>Baixar cópia do quadro atual</button>
          {savedBeforeImport === JSON.stringify({ data, focusBlocking, soundEnabled }) && <label><input type="checkbox" checked={backupAcknowledged} onChange={e => setBackupAcknowledged(e.target.checked)} /> Confirmei que a cópia foi salva no meu computador</label>}
          <div className="backup-actions"><button disabled={backupBusy || !!data.session || !backupAcknowledged || savedBeforeImport !== JSON.stringify({ data, focusBlocking, soundEnabled })} onClick={() => void restoreBackup('merge')}>Mesclar sem duplicar</button><button className="delete-task" disabled={backupBusy || !!data.session || !backupAcknowledged || savedBeforeImport !== JSON.stringify({ data, focusBlocking, soundEnabled })} onClick={() => void restoreBackup('replace')}>Substituir dados</button><button onClick={() => setImportPreview(null)}>Cancelar</button></div>
          {data.session && <p className="warning">Encerre o ciclo ou a pausa atual antes de importar.</p>}
        </div>}
      </section>}
    </section></div>}
    <nav className="board-controls" aria-label="Filtrar tarefas">
      <div className="board-view-scroll" id="tour-views"><div className="board-view-slider slide-tabs" style={{ '--tab-count': 5, '--active-index': showStatistics ? 0 : ['today', 'week', 'all', 'archive'].indexOf(view) + 1 } as React.CSSProperties}>
      <button aria-current={showStatistics ? 'page' : undefined} onClick={() => setShowStatistics(true)}>Estatísticas</button>
      {([['today', 'Hoje'], ['week', 'Esta semana'], ['all', 'Todas'], ['archive', 'Arquivo']] as const).map(([key, label]) =>
        <button key={key} aria-current={!showStatistics && view === key ? 'page' : undefined} onClick={() => { setView(key); setShowStatistics(false); }}>{label}</button>)}
      </div></div>
      <div className="board-tools" id="tour-tools">{!showStatistics && <label className="skill-filter">Área <select aria-label="Filtrar por habilidade ou área" value={skillFilter} onChange={event => setSkillFilter(event.target.value)}><option value="">Todas as áreas</option>{skills.map(skill => <option value={skill} key={skill}>{skill}</option>)}<option value="__without_skill__">Sem área</option></select></label>}
      <button className="focus-toggle" onClick={() => setShowFocusMode(true)}>◷ Modo foco</button><button className="weekly-toggle" aria-expanded={weeklyOpen} onClick={() => setWeeklyOpen(open => !open)}>↻ Rotinas semanais</button></div>
    </nav>
    {!!cycleSelection.length && !showStatistics && view !== 'archive' && <section className="cycle-builder" aria-label="Montar ciclo com várias tarefas"><div><span className="eyebrow">CICLO DE FOCO</span><h2>Seu ciclo, suas tarefas</h2><p>{cycleSelection.length} {cycleSelection.length === 1 ? 'tarefa' : 'tarefas'} · {cycleSelection.reduce((sum, key) => sum + (cycleMinutes[key] ?? data.tasks.find(item => item.id === key)?.estimate ?? 0), 0)} min no total. A ordem abaixo define a sequência; avance manualmente quando mudar de tarefa.</p></div>
      <div className="cycle-builder-steps">{cycleSelection.map((key, index) => { const item = data.tasks.find(t => t.id === key); return item && <label key={key}><span>{index + 1}. {item.name}</span><NumberStepper label={`Minutos para ${item.name}`} value={cycleMinutes[key] ?? item.estimate} min={1} max={480} onChange={minutes => setCycleMinutes(old => ({ ...old, [key]: minutes }))} /><small>min</small><button aria-label={`Mover ${item.name} para cima`} disabled={index === 0} onClick={() => setCycleSelection(old => { const next = [...old]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>↑</button><button aria-label={`Mover ${item.name} para baixo`} disabled={index === cycleSelection.length - 1} onClick={() => setCycleSelection(old => { const next = [...old]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}>↓</button></label>; })}</div>
      <button className="primary" disabled={!!active} onClick={() => startFocusTasks(cycleSelection.map(key => ({ taskId: key, minutes: cycleMinutes[key] ?? data.tasks.find(item => item.id === key)?.estimate ?? 0 })))}>Iniciar ciclo com {cycleSelection.length} tarefas</button></section>}
    {weeklyOpen && <section className="weekly-panel" aria-label="Rotinas semanais"><div><span className="eyebrow">PLANEJAMENTO</span><h2>Programação da semana</h2><p>Escolha os dias na criação da tarefa. Cada ocorrência mantém seu próprio histórico.</p><button onClick={() => openManualDraft('', true)}>+ Nova tarefa programada</button></div>
      <div className="week-calendar">{calendarDays.map(day => <div className={localDay(day) === today ? 'calendar-day current' : 'calendar-day'} key={localDay(day)}><strong>{weekdays[day.getDay()]} <small>{day.getDate()}/{day.getMonth() + 1}</small></strong>
        {data.weeklyPlans.filter(plan => plan.weekdays.includes(day.getDay()) && localDay(day) >= plan.startsOn && (!plan.endsOn || localDay(day) <= plan.endsOn)).map(plan => <span key={plan.id}>{plan.name}</span>)}
      </div>)}</div>
      <div className="weekly-list">{data.weeklyPlans.map(plan => <article key={plan.id}><strong>{plan.name}</strong><span>{plan.weekdays.map(day => weekdays[day]).join(', ')} · {plan.estimate} min · {plan.endsOn ? `até ${plan.endsOn.split('-').reverse().join('/')}` : 'toda semana'}</span><button onClick={() => { if (window.confirm(`Excluir a programação “${plan.name}”? As tarefas já criadas permanecerão no histórico.`)) update(old => ({ ...old, weeklyPlans: old.weeklyPlans.filter(p => p.id !== plan.id) })); }}>Excluir programação</button></article>)}</div>
    </section>}
    {showStatistics ? <Statistics tasks={data.tasks} history={data.history} now={now} wipLimit={data.wipLimits.doing} onClose={() => setShowStatistics(false)} /> : view === 'archive' ? <section className="archive-panel"><div className="archive-heading"><div><span className="eyebrow">HISTÓRICO</span><h2>Tarefas arquivadas</h2></div><label>Dia da conclusão <input type="date" value={archiveDay} onChange={e => setArchiveDay(e.target.value)} /></label></div>
      {shownTasks.length === 0 ? <p>Nenhuma tarefa arquivada para este dia.</p> : shownTasks.slice().sort((a, b) => (b.completedAt ?? b.archivedAt ?? 0) - (a.completedAt ?? a.archivedAt ?? 0)).map(item => <article className="archive-entry" key={item.id}><div><strong>{item.name}</strong><span>{item.completedAt ? `Concluída em ${displayDate(item.completedAt)}` : `Conclusão sem data · arquivada em ${displayDate(item.archivedAt)}`} · {minutes(item.focusSeconds)} de foco</span></div><button onClick={() => setSelectedTask(item.id)}>Detalhes</button></article>)}
    </section> : <div className="board">{columns.map(column => <section className={`lane ${column.id === 'doing' && doingCount > data.wipLimits.doing || column.id === 'late' && data.wipLimits.late && lateCount > data.wipLimits.late ? 'lane-over-wip' : ''}`} key={column.id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const key = event.dataTransfer.getData('text/plain'); if (key && !active?.steps?.some(step => step.taskId === key) && key !== active?.taskId) changeTask(key, item => ({ ...item, column: column.id, completedAt: column.id === 'done' ? Date.now() : undefined })); }}>
      <h2 id={column.id === 'todo' ? 'tour-board' : undefined}>{column.label} <span>{shownTasks.filter(t => t.column === column.id).length}{(column.id === 'doing' && doingCount > data.wipLimits.doing || column.id === 'late' && data.wipLimits.late && lateCount > data.wipLimits.late) ? ' ⚠' : ''}</span></h2>
      {column.id === 'doing' && doingCount > data.wipLimits.doing && <p className="warning">⚠ {doingCount}/{data.wipLimits.doing} em andamento. Considere concluir antes de assumir mais.</p>}
      {column.id === 'late' && data.wipLimits.late && lateCount > data.wipLimits.late && <p className="warning">⚠ {lateCount}/{data.wipLimits.late} em atraso. Vale revisar sua capacidade.</p>}
      {shownTasks.filter(t => t.column === column.id).map((item, index) => { const overdue = item.column !== 'done' && !!item.deadline && item.deadline < today;
        const dueSoon = item.column !== 'done' && !!item.deadline && item.deadline >= today && item.deadline <= soonDay;
        return <article className={`card${overdue ? ' card-overdue' : dueSoon ? ' card-due-soon' : ''}`} key={item.id} draggable onDragStart={event => event.dataTransfer.setData('text/plain', item.id)}>
        <div className="card-heading"><span>{String(index + 1).padStart(2, '0')} / {column.label.toUpperCase()}</span><span className="card-time">{item.estimate} MIN</span></div>
        {(column.id === 'doing' || column.id === 'todo') && !active && <label className="cycle-select"><input type="checkbox" checked={cycleSelection.includes(item.id)} onChange={event => setCycleSelection(old => event.target.checked ? [...old, item.id] : old.filter(key => key !== item.id))} /> Incluir no próximo ciclo</label>}
        <button className="card-title" onClick={() => { setSelectedTask(item.id); setScope('whole'); setSelectedSlices([]); setSliceInsight(''); }}>{item.name}</button>
        <div className="meta"><span>Dificuldade {item.difficulty}</span><span>{item.estimate} min</span>{item.deadline && <span>{item.deadline}</span>}{overdue && <span className="overdue-badge">⚠ Prazo vencido</span>}{dueSoon && <span className="due-soon-badge">◷ Prazo próximo</span>}{item.planId && <span>↻ {item.occurrenceDate}</span>}{item.column === 'done' && <span>Feita em {displayDate(item.completedAt)}</span>}</div>
        {!!item.slices.length && <><div className="slice-progress">Etapas <strong>{item.slices.filter(slice => slice.done).length}/{item.slices.length}</strong></div><div className="slice-strip">{item.slices.map(slice => <span className={slice.done ? 'slice done' : 'slice'} title={slice.name} key={slice.id}>{slice.name}{slice.done ? ' ✓' : ''}</span>)}</div></>}
      </article>; })}{!shownTasks.some(t => t.column === column.id) && <p className="empty-lane">Nenhuma tarefa nesta coluna.</p>}</section>)}</div>}
    {task && <div className={`backdrop${phase === 'decision' ? ' task-detail-backdrop' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) setSelectedTask(null); }}><section className="dialog" role="dialog" aria-modal="true" aria-label="Detalhes da tarefa">
      <button className="close" onClick={() => setSelectedTask(null)}>✕</button><span className="eyebrow">DETALHES DA TAREFA</span>
      <input className="task-name" aria-label="Nome" value={task.name} onChange={e => changeTask(task.id, x => ({ ...x, name: e.target.value }))} />
      <textarea aria-label="Descrição" placeholder="Descrição da tarefa" value={task.description} onChange={e => changeTask(task.id, x => ({ ...x, description: e.target.value }))} />
      <div className="fields"><label>Dificuldade <select value={task.difficulty} onChange={e => changeTask(task.id, x => ({ ...x, difficulty: +e.target.value as 1 | 2 | 3 }))}><option value="1">1 · leve</option><option value="2">2 · média</option><option value="3">3 · alta</option></select></label>
      <label>Estimativa total da tarefa (min) <NumberStepper label="Estimativa total da tarefa" value={task.estimate} min={1} max={480} onChange={estimate => changeTask(task.id, x => ({ ...x, estimate }))} /></label>
      <label>Habilidade ou área <input maxLength={50} list="skill-suggestions" placeholder="Ex.: Programação" value={task.skill ?? ''} onChange={e => changeTask(task.id, x => ({ ...x, skill: e.target.value }))} /></label>
      <label>Prazo opcional <input type="date" value={task.deadline} onChange={e => changeTask(task.id, x => ({ ...x, deadline: e.target.value }))} /></label>
      <label>Coluna <select value={task.column} onChange={e => changeTask(task.id, x => ({ ...x, column: e.target.value as Column }))}>{columns.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</select></label></div>
      <h3>Slices</h3><div className="slices">{task.slices.map(slice => <div className="slice-editor" key={slice.id}><label><input type="checkbox" checked={slice.done} onChange={() => changeTask(task.id, x => ({ ...x, slices: x.slices.map(s => s.id === slice.id ? { ...s, done: !s.done } : s) }))} /><input aria-label={`Nome do slice ${slice.name}`} value={slice.name} maxLength={140} onChange={e => { setSliceInsight(''); changeTask(task.id, x => ({ ...x, slices: x.slices.map(s => s.id === slice.id ? { ...s, name: e.target.value } : s) })); }} /></label><label>min estimados <input aria-label={`Minutos estimados para ${slice.name}`} type="number" min="1" max="480" value={slice.estimateMinutes ?? ''} placeholder="—" onChange={e => { setSliceInsight(''); changeTask(task.id, x => ({ ...x, slices: x.slices.map(s => s.id === slice.id ? { ...s, estimateMinutes: e.target.value ? Math.max(1, Math.min(480, Number(e.target.value))) : undefined } : s) })); }} /></label><button type="button" aria-label={`Remover slice ${slice.name}`} onClick={() => { setSliceInsight(''); changeTask(task.id, x => ({ ...x, slices: x.slices.filter(s => s.id !== slice.id) })); }}>✕</button></div>)}</div>
      <form onSubmit={e => { e.preventDefault(); if (sliceDraft.trim()) { changeTask(task.id, x => ({ ...x, slices: [...x.slices, { id: id(), name: sliceDraft.trim(), done: false }] })); setSliceDraft(''); setSliceInsight(''); } }} className="add-slice"><input placeholder="Nome do slice" value={sliceDraft} onChange={e => setSliceDraft(e.target.value)} /><button>Adicionar</button></form>
      <button disabled={insightBusy} onClick={() => void requestSliceInsight(task)}>{insightBusy ? 'Analisando…' : '✦ Analisar distribuição dos slices'}</button>
      {sliceInsight && <p className="slice-insight" role="status">{sliceInsight}</p>}
      <h3>Iniciar foco</h3><div className="scope"><label><input type="radio" checked={scope === 'whole'} onChange={() => setScope('whole')} /> Tarefa inteira</label><label><input type="radio" checked={scope === 'slices'} onChange={() => setScope('slices')} /> Selecionar slices</label></div>
      {scope === 'slices' && <div className="slices">{task.slices.filter(s => !s.done).map(s => <label key={s.id}><input type="checkbox" checked={selectedSlices.includes(s.id)} onChange={() => setSelectedSlices(old => old.includes(s.id) ? old.filter(v => v !== s.id) : [...old, s.id])} />{s.name}</label>)}</div>}
      <p className="summary">{minutes(task.focusSeconds)} de foco registrado · {task.failures} tentativas falhas</p>
      {task.deadline && task.deadline < today && task.column !== 'done' && <p className="warning">O prazo venceu. A coluna só muda quando você decidir o próximo passo.</p>}
      {active?.taskId === task.id && (phase === 'running' || phase === 'decision') && <button className="delete-task" onClick={() => nextCycleTask('failed')}>Não consegui terminar · registrar tentativa e avançar</button>}
      {task.column === 'done' && <p className="summary">Concluída em {displayDate(task.completedAt)}{task.archivedAt ? ` · arquivada em ${displayDate(task.archivedAt)}` : ''}</p>}
      {!!task.attachments?.length && <><h3>Anexos</h3><div className="task-attachments">{task.attachments.map((link, index) => <a key={index} href={link.url} target="_blank" rel="noopener noreferrer">{link.title} ↗</a>)}</div></>}
      <div className="task-actions"><button className="primary" disabled={!!active || !!task.archivedAt} onClick={() => { startFocus(task); if (!active) setSelectedTask(null); }}>Iniciar ciclo de {task.estimate} min</button>
        {task.column === 'done' && !task.archivedAt && <button className="archive-task" onClick={() => archiveTask(task)}>Arquivar concluída</button>}
        {task.archivedAt && <button className="archive-task" onClick={() => { changeTask(task.id, current => ({ ...current, archivedAt: undefined })); setSelectedTask(null); setToast('Tarefa restaurada para o quadro.'); }}>Restaurar</button>}
        <button className="delete-task" onClick={() => deleteTask(task)}>Apagar tarefa</button></div>
    </section></div>}
    <datalist id="skill-suggestions"><option value="Programação" /><option value="Estudo" /><option value="Escrita" /><option value="Organização" /></datalist>
  </main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
