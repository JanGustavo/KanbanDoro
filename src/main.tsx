import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { getAISettings, saveAISettings, clearAISettings, AI_PROVIDERS, type AISettings, type AIProvider } from './aiSettings';
import { isVisible, localDay, materializeToday, type ViewMode, type WeeklyPlan } from './schedule';

type Column = 'todo' | 'doing' | 'late' | 'done';
type Slice = { id: string; name: string; done: boolean };
type Attachment = { title: string; url: string; verifiedAt: number | null; reason: string };
type Task = {
  id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3;
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
  phase: 'running' | 'decision' | 'post-focus' | 'break' | 'break-done';
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
};
type HistoryEntry = { id: string; taskId: string; kind: string; seconds: number; at: number; sliceIds: string[] };
type Proposal = { name: string; description: string; difficulty: 1 | 2 | 3; estimate: number; slices: string[]; attachments: Attachment[] };
type GroqModel = { id: string; name: string };
type Data = { tasks: Task[]; session: Session | null; history: HistoryEntry[]; breakPreferences: string[]; weeklyPlans: WeeklyPlan[] };
const columns: { id: Column; label: string }[] = [
  { id: 'todo', label: 'A fazer' }, { id: 'doing', label: 'Em andamento' },
  { id: 'late', label: 'Em atraso' }, { id: 'done', label: 'Concluído' },
];
const initial: Data = { tasks: [], session: null, history: [], breakPreferences: ['Descanso', 'Água', 'Comida', 'Detox'], weeklyPlans: [] };
const id = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
const minutes = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
const loadingTips = [
  'Um ciclo de foco pode cobrir a tarefa inteira ou apenas alguns slices.',
  'Pausas também têm cronômetro. Escolha o tipo e a duração antes de começar.',
  'Cinco tarefas em andamento são o limite sugerido para manter o foco.',
  'O tempo registrado continua disponível quando você reabre o navegador.',
];
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const displayDate = (time?: number) => time ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(time) : 'Data anterior ao registro';
function newOccurrence(plan: WeeklyPlan, day: string): Task {
  return { id: id(), name: plan.name, description: '', difficulty: 1, estimate: plan.estimate, deadline: '', column: 'todo',
    failures: 0, focusSeconds: 0, slices: [], planId: plan.id, occurrenceDate: day, createdAt: Date.now() };
}

function App() {
  const [data, setData] = useState<Data>(initial);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState('');
  const [sliceDraft, setSliceDraft] = useState('');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [scope, setScope] = useState<'whole' | 'slices'>('whole');
  const [selectedSlices, setSelectedSlices] = useState<string[]>([]);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [requestedExtension, setRequestedExtension] = useState(5);
  const [breakType, setBreakType] = useState('Descanso');
  const [error, setError] = useState('');
  const [restart, setRestart] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'breaks' | 'ai'>('breaks');
  const [aiSettings, setAiSettings] = useState<AISettings>({ provider: '', apiKey: '', model: '', customEndpoint: '' });
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [models, setModels] = useState<GroqModel[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [feedback, setFeedback] = useState('');
  const [proposalTab, setProposalTab] = useState<'details' | 'attachments'>('details');
  const [proposalRevision, setProposalRevision] = useState(0);
  const [checkingLink, setCheckingLink] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tipsDismissed, setTipsDismissed] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);
  const [toast, setToast] = useState('');
  const [view, setView] = useState<ViewMode>('today');
  const [archiveDay, setArchiveDay] = useState('');
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyName, setWeeklyName] = useState('');
  const [weeklyEstimate, setWeeklyEstimate] = useState(25);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    chrome.storage.local.get(['tasks', 'session', 'history', 'breakPreferences', 'weeklyPlans']).then((stored) => {
      const tasks = (stored.tasks as Task[] | undefined) ?? [];
      const weeklyPlans = (stored.weeklyPlans as WeeklyPlan[] | undefined) ?? [];
      const generated = materializeToday(tasks, weeklyPlans, new Date(), newOccurrence);
      setData({ tasks: generated.tasks, weeklyPlans: generated.plans, session: (stored.session as Session | undefined) ?? null, history: (stored.history as HistoryEntry[] | undefined) ?? [], breakPreferences: (stored.breakPreferences as string[] | undefined) ?? ['Descanso', 'Água', 'Comida', 'Detox'] });
      setReady(true);
    });
    getAISettings().then(setAiSettings);
    chrome.storage.local.get(['soundEnabled', 'tipsDismissed']).then(stored => {
      setSoundEnabled(stored.soundEnabled !== false);
      setTipsDismissed(stored.tipsDismissed === true);
    });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const tips = window.setInterval(() => setTipIndex(i => (i + 1) % loadingTips.length), 6000);
    return () => { window.clearInterval(timer); window.clearInterval(tips); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (ready) void chrome.storage.local.set(data);
  }, [data, ready]);
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
  const activeTask = data.tasks.find(t => t.id === active?.taskId);
  const due = active && (active.phase === 'running' || active.phase === 'break') && now >= active.endsAt;
  const phase = due ? (active?.phase === 'running' ? 'decision' : 'break-done') : active?.phase;
  const doingCount = data.tasks.filter(t => t.column === 'doing' && !t.archivedAt).length;
  const shownTasks = data.tasks.filter(t => isVisible(t, view, new Date(now), archiveDay));
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
    if (!name.trim()) return;
    const item: Task = { id: id(), name: name.trim(), description: '', difficulty: 1, estimate: 25, createdAt: Date.now(),
      deadline: '', column: 'todo', failures: 0, focusSeconds: 0, slices: [] };
    update(old => ({ ...old, tasks: [...old.tasks, item] }));
    setName('');
    setSelectedTask(item.id);
    setToast('Tarefa criada. Abra os detalhes para definir tempo e slices.');
  }
  function addWeeklyPlan(event: React.FormEvent) {
    event.preventDefault();
    if (!weeklyName.trim() || !weeklyDays.length || !Number.isInteger(weeklyEstimate) || weeklyEstimate < 1 || weeklyEstimate > 480) {
      setError('Informe um nome, duração entre 1 e 480 minutos e ao menos um dia da semana.');
      return;
    }
    const plan: WeeklyPlan = { id: id(), name: weeklyName.trim(), estimate: weeklyEstimate, weekdays: [...weeklyDays].sort(), startsOn: localDay(new Date()), generatedDates: [] };
    update(old => {
      const generated = materializeToday(old.tasks, [...old.weeklyPlans, plan], new Date(), newOccurrence);
      return { ...old, tasks: generated.tasks, weeklyPlans: generated.plans };
    });
    setWeeklyName(''); setError(''); setToast('Rotina salva. Uma tarefa será criada em cada dia escolhido quando o quadro for aberto.');
  }
  function deleteTask(item: Task) {
    if (active?.taskId === item.id) return setError('Encerre o ciclo atual antes de apagar esta tarefa.');
    if (!window.confirm(`Apagar “${item.name}” e seu histórico de foco? Esta ação não pode ser desfeita.`)) return;
    update(old => ({ ...old, tasks: old.tasks.filter(task => task.id !== item.id), history: old.history.filter(entry => entry.taskId !== item.id) }));
    setSelectedTask(null); setToast('Tarefa e histórico removidos. A rotina semanal, se houver, continua ativa.');
  }
  function archiveTask(item: Task) {
    if (item.column !== 'done') return setError('Conclua a tarefa antes de arquivar.');
    changeTask(item.id, task => ({ ...task, archivedAt: Date.now() }));
    setSelectedTask(null); setToast('Tarefa arquivada. Você pode consultá-la pelo dia da conclusão.');
  }
  async function loadModels() {
    setAiBusy(true); setAiNotice('');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GROQ_MODELS' }) as { models?: GroqModel[]; error?: string };
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
      const response = await chrome.runtime.sendMessage({ type: 'GROQ_TASK_PROPOSAL', input: name, previous: proposal, feedback: comment }) as { proposal?: Proposal; error?: string };
      if (response.error || !response.proposal) throw Error(response.error || 'A IA não retornou uma proposta.');
      setProposal(response.proposal); setFeedback(''); setProposalRevision(value => comment ? value + 1 : 1);
      if (!comment) setProposalTab('details');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'A Groq não respondeu.'); }
    finally { setAiBusy(false); }
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
    const item: Task = { id: id(), name: proposal.name.trim(), description: proposal.description, difficulty: proposal.difficulty, createdAt: Date.now(),
      estimate: proposal.estimate, deadline: '', column: 'todo', failures: 0, focusSeconds: 0,
      slices: proposal.slices.filter(s => s.trim()).map(s => ({ id: id(), name: s.trim(), done: false })),
      attachments: proposal.attachments.filter(link => link.title.trim() && link.verifiedAt && Date.now() - link.verifiedAt < 10 * 60_000) };
    update(old => ({ ...old, tasks: [...old.tasks, item] }));
    setProposal(null); setName(''); setSelectedTask(item.id);
    setToast('Proposta aceita. Só os anexos verificados foram salvos.');
  }
  function startFocus(item: Task) {
    if (active) return setError('Encerre o ciclo ou descanso atual antes de iniciar outro.');
    if (scope === 'slices' && selectedSlices.length === 0) return setError('Escolha ao menos um slice.');
    const t = Date.now();
    update(old => ({ ...old,
      tasks: old.tasks.map(x => x.id === item.id ? { ...x, column: 'doing' } : x),
      session: { taskId: item.id, phase: 'running', startedAt: t, endsAt: t + item.estimate * 60000,
        originalMinutes: item.estimate, extensionMinutes: 0, extensions: 0,
        scope, selectedSliceIds: scope === 'whole' ? [] : selectedSlices, breakType: '', creditedSeconds: 0, excludedSeconds: 0 },
    }));
    setError('');
    setToast('Ciclo iniciado. O cronômetro segue mesmo se você fechar o quadro.');
  }
  function credit(old: Data, kind: string): Data {
    const s = old.session;
    if (!s) return old;
    const elapsed = Math.max(0, Math.floor((Math.min(Date.now(), s.endsAt) - s.startedAt) / 1000));
    const total = Math.max(0, elapsed - s.creditedSeconds - (s.excludedSeconds ?? 0));
    const entry: HistoryEntry = { id: id(), taskId: s.taskId, kind, seconds: total, at: Date.now(), sliceIds: s.selectedSliceIds };
    return { ...old, tasks: old.tasks.map(t => t.id === s.taskId ? { ...t, focusSeconds: t.focusSeconds + total } : t),
      history: [...old.history, entry] };
  }
  function extend(amount: number) {
    if (!active || phase !== 'decision') return;
    const max = Math.floor(active.originalMinutes * .5);
    if (active.extensions >= 2 || amount <= 0 || active.extensionMinutes + amount > max) return;
    update(old => ({ ...old, session: old.session && { ...old.session, phase: 'running', endsAt: Math.max(Date.now(), old.session.endsAt) + amount * 60000,
      excludedSeconds: (old.session.excludedSeconds ?? 0) + Math.max(0, Math.floor((Date.now() - old.session.endsAt) / 1000)),
      extensions: old.session.extensions + 1, extensionMinutes: old.session.extensionMinutes + amount } }));
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
      return { ...credited, tasks, session: kind === 'completed' || kind === 'failed'
        ? { ...active, phase: 'post-focus', creditedSeconds: Math.floor((Date.now() - active.startedAt) / 1000) }
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
    <header><div><span className="eyebrow">TRABALHO COM RITMO</span><h1>Kanban<span>Doro</span></h1><p>Organize a tarefa. Dê tempo ao que importa.</p></div>
      <div className="header-actions">
        <button className="ghost" onClick={() => chrome.runtime.sendMessage({ type: 'SHOW_TIMER' })}>Mostrar bolha</button>
        <button className="ghost" onClick={() => setShowSettings(true)}>Preferências</button>
        <div className="status">{active ? '● Ciclo ativo' : '○ Pronto para começar'}</div>
      </div>
    </header>
    {error && <p className="warning" role="alert">{error} <button onClick={() => setError('')}>Fechar</button></p>}
    {toast && <div className="toast" role="status">{toast}<button aria-label="Dispensar aviso" onClick={() => setToast('')}>✕</button></div>}
    {!tipsDismissed && data.tasks.length === 0 && <aside className="first-use" aria-label="Primeiros passos">
      <span className="eyebrow">PRIMEIROS PASSOS</span><p>Crie uma tarefa, ajuste o tempo e os slices nos detalhes e inicie seu primeiro ciclo de foco.</p>
      <button onClick={() => { setTipsDismissed(true); void chrome.storage.local.set({ tipsDismissed: true }); }}>Entendi</button>
    </aside>}
    {active && <section className="focus" aria-label="Ciclo atual">
      <div><span className="eyebrow">{phase === 'break' || phase === 'break-done' ? active.breakType : 'FOCO EM ANDAMENTO'}</span>
        <h2>{activeTask?.name ?? 'Tarefa removida'}</h2><small>{active.scope === 'whole' ? 'Tarefa inteira' : `${active.selectedSliceIds.length} slices • tempo compartilhado`}</small></div>
      <strong className="clock">{phase === 'decision' || phase === 'break-done' ? '00:00' : minutes(Math.ceil((active.endsAt - now) / 1000))}</strong>
      <div className="focus-actions">
        {phase === 'running' && <><button onClick={() => stopFocus('completed')}>Concluí o escopo</button><button onClick={() => stopFocus('interrupted')}>Interromper e deixar para depois</button><button onClick={() => { stopFocus('interrupted'); if (activeTask) setRestart(activeTask); }}>Interromper e recomeçar</button></>}
        {phase === 'decision' && <><button onClick={() => stopFocus('completed')}>Concluí o escopo</button>
          {active.extensions < 2 && active.extensionMinutes < Math.floor(active.originalMinutes * .5) && <><label>Extensão (min) <input type="number" min="1" max={Math.floor(active.originalMinutes * .5) - active.extensionMinutes} value={requestedExtension} onChange={e => setRequestedExtension(+e.target.value)} /></label><button onClick={() => extend(requestedExtension)}>Estender ({active.extensions}/2)</button></>}
          <button onClick={() => stopFocus('failed')}>Não consegui terminar</button></>}
        {phase === 'post-focus' && <>
          <label>Pausa <select value={breakType} onChange={e => setBreakType(e.target.value)}>{[...data.breakPreferences, 'Outra'].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          <label>min <input type="number" min="1" max="120" value={breakMinutes} onChange={e => setBreakMinutes(+e.target.value)} /></label>
          <button onClick={startBreak}>Iniciar pausa</button><button onClick={() => update(old => ({ ...old, session: null }))}>Finalizar ciclo</button></>}
        {phase === 'break' && <button onClick={() => update(old => ({ ...old, session: null }))}>Encerrar pausa</button>}
        {phase === 'break-done' && <><span role="status">Pausa encerrada. Confirme antes de voltar ao foco.</span><button onClick={() => update(old => ({ ...old, session: null }))}>Entendi</button></>}
      </div>
    </section>}
    <form className="create" onSubmit={addTask}><input aria-label="Nome da tarefa" placeholder="Qual é a próxima tarefa?" value={name} onChange={e => setName(e.target.value)} /><button type="submit">+ Criar tarefa</button><button type="button" disabled={aiBusy || !name.trim()} onClick={() => void requestProposal()}>{aiBusy ? 'Consultando…' : 'Propor com IA'}</button></form>
    {proposal && <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setProposal(null); }}><section key={proposalRevision} className="dialog proposal-dialog" role="dialog" aria-modal="true" aria-label="Revisar proposta da IA">
      <header className="proposal-header"><span className="proposal-spark" aria-hidden="true">ϟ</span><div><span className="eyebrow">{proposalRevision > 1 ? 'PROPOSTA ATUALIZADA' : 'NOVA PROPOSTA'}</span><h2>{proposalRevision > 1 ? 'Uma nova versão para você' : 'Uma ideia para começar'}</h2><p>Revise os detalhes antes de adicionar ao quadro.</p></div><button className="close" onClick={() => setProposal(null)} aria-label="Fechar proposta">✕</button></header>
      {error && <p className="warning" role="alert">{error}</p>}
      <div className="proposal-tabs" role="tablist" aria-label="Conteúdo da proposta"><button role="tab" aria-selected={proposalTab === 'details'} onClick={() => setProposalTab('details')}>Tarefa e etapas</button><button role="tab" aria-selected={proposalTab === 'attachments'} onClick={() => setProposalTab('attachments')}>Anexos <span>{proposal.attachments.length}</span></button></div>
      {proposalTab === 'details' ? <div className="proposal-pane">
      <label>Nome <input className="task-name" value={proposal.name} onChange={e => setProposal({ ...proposal, name: e.target.value })} /></label>
      <label>Descrição <textarea value={proposal.description} onChange={e => setProposal({ ...proposal, description: e.target.value })} /></label>
      <div className="fields"><label className="highlight-time">Tempo sugerido (min) <input type="number" min="1" max="480" value={proposal.estimate} onChange={e => setProposal({ ...proposal, estimate: +e.target.value })} /></label>
      <label>Dificuldade <select value={proposal.difficulty} onChange={e => setProposal({ ...proposal, difficulty: +e.target.value as 1 | 2 | 3 })}><option value="1">1 · leve</option><option value="2">2 · média</option><option value="3">3 · alta</option></select></label></div>
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
      <label className="revision-label">Quer mudar algo? <textarea placeholder="Ex.: reduza o tempo e separe o backend em duas etapas" value={feedback} onChange={e => setFeedback(e.target.value)} /></label>
      <div className="proposal-actions"><button className="reject" onClick={() => { setProposal(null); setFeedback(''); }}>Rejeitar</button><button disabled={aiBusy || !feedback.trim()} onClick={() => void requestProposal(feedback)}>Reescrever com IA</button><button className="accept" disabled={aiBusy} onClick={acceptProposal}>Aceitar e criar tarefa</button></div>
    </section></div>}
    {showSettings && <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowSettings(false); }}><section className="dialog" role="dialog" aria-modal="true" aria-label="Preferências">
      <button className="close" onClick={() => setShowSettings(false)}>✕</button><span className="eyebrow">PREFERÊNCIAS</span>
      <div className="settings-tabs" role="tablist">
        <button role="tab" aria-selected={settingsTab === 'breaks'} onClick={() => setSettingsTab('breaks')}>Pausas</button>
        <button role="tab" aria-selected={settingsTab === 'ai'} onClick={() => setSettingsTab('ai')}>IA</button>
      </div>
      {settingsTab === 'breaks' && (
        <>
          <label className="sound-option"><input type="checkbox" checked={soundEnabled} onChange={e => { setSoundEnabled(e.target.checked); void chrome.storage.local.set({ soundEnabled: e.target.checked }); }} /> Tocar aviso ao terminar foco ou pausa</label>
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
      {settingsTab === 'ai' && (
        <>
          <h3>Assistência de IA</h3>
          <p className="settings-hint">A proposta de tarefas está disponível com Groq. Salve sua chave para consultar os modelos da sua conta. Outros provedores ainda estão em preparação.</p>
          <div className="ai-settings-form">
            <label>
              Provedor
              <select value={aiSettings.provider} onChange={e => setAiSettings((s: AISettings) => ({ ...s, provider: e.target.value as AIProvider, model: '', customEndpoint: '' }))}>
                <option value="">Selecionar provedor</option>
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => <option key={key} value={key} disabled={key !== 'groq'}>{provider}{key !== 'groq' ? ' · em breve' : ''}</option>)}
              </select>
            </label>
                {aiSettings.provider && (
              <>
                <label>
                  Modelo
                  {aiSettings.provider === 'groq' ? <><select value={aiSettings.model} onChange={e => setAiSettings(s => ({ ...s, model: e.target.value }))}><option value="">{models.length ? 'Selecione um modelo' : 'Consulte os modelos da sua conta'}</option>{models.map(model => <option key={model.id} value={model.id}>{model.name} ({model.id})</option>)}</select><button type="button" disabled={aiBusy} onClick={() => void loadModels()}>Atualizar modelos</button></> : <input value={aiSettings.model} onChange={e => setAiSettings(s => ({ ...s, model: e.target.value }))} />}
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
                      placeholder="sk-... ou sua chave"
                      value={aiSettings.apiKey}
                      onChange={e => setAiSettings((s: AISettings) => ({ ...s, apiKey: e.target.value }))}
                      autoComplete="off"
                    />
                    <button type="button" onClick={() => setAiKeyVisible(v => !v)} aria-label={aiKeyVisible ? 'Ocultar chave' : 'Mostrar chave'}>
                      {aiKeyVisible ? '🙈' : '👁'}
                    </button>
                  </div>
                </label>
                <div className="ai-actions">
                  <button className="primary" onClick={async () => { await saveAISettings(aiSettings); setAiNotice(aiSettings.model ? 'Modelo salvo. Já pode propor uma tarefa.' : 'Chave salva. Agora consulte os modelos e escolha um.'); }} disabled={aiSettings.provider !== 'groq' || !aiSettings.apiKey}>
                    Salvar chave e modelo
                  </button>
                  {aiSettings.apiKey && (
                    <button className="danger" onClick={async () => { await clearAISettings(); setAiSettings({ provider: '', apiKey: '', model: '', customEndpoint: '' }); setAiNotice('Chave removida deste navegador.'); }}>
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
    </section></div>}
    <nav className="board-controls" aria-label="Filtrar tarefas">
      {([['today', 'Hoje'], ['week', 'Esta semana'], ['all', 'Todas'], ['archive', 'Arquivo']] as const).map(([key, label]) =>
        <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}>{label}</button>)}
      <button className="weekly-toggle" aria-expanded={weeklyOpen} onClick={() => setWeeklyOpen(open => !open)}>↻ Rotinas semanais</button>
    </nav>
    {weeklyOpen && <section className="weekly-panel" aria-label="Rotinas semanais"><div><span className="eyebrow">PLANEJAMENTO</span><h2>Rotinas da semana</h2><p>Uma ocorrência nasce nos dias selecionados quando você abre o quadro. Cada dia mantém seu próprio histórico.</p></div>
      <form onSubmit={addWeeklyPlan} className="weekly-form"><input aria-label="Nome da rotina" placeholder="Ex.: verificar e-mails" value={weeklyName} onChange={e => setWeeklyName(e.target.value)} /><label>Min <input aria-label="Tempo estimado da rotina" type="number" min="1" max="480" value={weeklyEstimate} onChange={e => setWeeklyEstimate(+e.target.value)} /></label>
        <div className="weekdays" role="group" aria-label="Dias da semana">{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={weeklyDays.includes(index)} onChange={() => setWeeklyDays(days => days.includes(index) ? days.filter(d => d !== index) : [...days, index])} />{day}</label>)}</div><button className="primary">Criar rotina</button></form>
      <div className="week-calendar">{calendarDays.map(day => <div className={localDay(day) === today ? 'calendar-day current' : 'calendar-day'} key={localDay(day)}><strong>{weekdays[day.getDay()]} <small>{day.getDate()}/{day.getMonth() + 1}</small></strong>
        {data.weeklyPlans.filter(plan => plan.weekdays.includes(day.getDay()) && localDay(day) >= plan.startsOn).map(plan => <span key={plan.id}>{plan.name}</span>)}
      </div>)}</div>
      <div className="weekly-list">{data.weeklyPlans.map(plan => <article key={plan.id}><strong>{plan.name}</strong><span>{plan.weekdays.map(day => weekdays[day]).join(', ')} · {plan.estimate} min</span><button onClick={() => { if (window.confirm(`Excluir a rotina “${plan.name}”? As tarefas já criadas permanecerão no histórico.`)) update(old => ({ ...old, weeklyPlans: old.weeklyPlans.filter(p => p.id !== plan.id) })); }}>Excluir rotina</button></article>)}</div>
    </section>}
    {view === 'archive' ? <section className="archive-panel"><div className="archive-heading"><div><span className="eyebrow">HISTÓRICO</span><h2>Tarefas arquivadas</h2></div><label>Dia da conclusão <input type="date" value={archiveDay} onChange={e => setArchiveDay(e.target.value)} /></label></div>
      {shownTasks.length === 0 ? <p>Nenhuma tarefa arquivada para este dia.</p> : shownTasks.slice().sort((a, b) => (b.completedAt ?? b.archivedAt ?? 0) - (a.completedAt ?? a.archivedAt ?? 0)).map(item => <article className="archive-entry" key={item.id}><div><strong>{item.name}</strong><span>{item.completedAt ? `Concluída em ${displayDate(item.completedAt)}` : `Conclusão sem data · arquivada em ${displayDate(item.archivedAt)}`} · {minutes(item.focusSeconds)} de foco</span></div><button onClick={() => setSelectedTask(item.id)}>Detalhes</button></article>)}
    </section> : <div className="board">{columns.map(column => <section className="lane" key={column.id}>
      <h2>{column.label} <span>{shownTasks.filter(t => t.column === column.id).length}</span></h2>
      {column.id === 'doing' && doingCount > 5 && <p className="warning">WIP acima de 5. Vale revisar a capacidade antes de assumir outra tarefa.</p>}
      {shownTasks.filter(t => t.column === column.id).map(item => <article className="card" key={item.id}>
        <button className="card-title" onClick={() => { setSelectedTask(item.id); setScope('whole'); setSelectedSlices([]); }}>{item.name}</button>
        <div className="meta"><span>Dificuldade {item.difficulty}</span><span>{item.estimate} min</span>{item.deadline && <span>{item.deadline}</span>}{item.planId && <span>↻ {item.occurrenceDate}</span>}{item.column === 'done' && <span>Feita em {displayDate(item.completedAt)}</span>}</div>
        <div className="slice-strip">{item.slices.map(slice => <span className={slice.done ? 'slice done' : 'slice'} key={slice.id}>{slice.name}</span>)}</div>
      </article>)}{!shownTasks.some(t => t.column === column.id) && <p className="empty-lane">Nenhuma tarefa nesta coluna.</p>}</section>)}</div>}
    {task && <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedTask(null); }}><section className="dialog" role="dialog" aria-modal="true" aria-label="Detalhes da tarefa">
      <button className="close" onClick={() => setSelectedTask(null)}>✕</button><span className="eyebrow">DETALHES DA TAREFA</span>
      <input className="task-name" aria-label="Nome" value={task.name} onChange={e => changeTask(task.id, x => ({ ...x, name: e.target.value }))} />
      <textarea aria-label="Descrição" placeholder="Descrição da tarefa" value={task.description} onChange={e => changeTask(task.id, x => ({ ...x, description: e.target.value }))} />
      <div className="fields"><label>Dificuldade <select value={task.difficulty} onChange={e => changeTask(task.id, x => ({ ...x, difficulty: +e.target.value as 1 | 2 | 3 }))}><option value="1">1 · leve</option><option value="2">2 · média</option><option value="3">3 · alta</option></select></label>
      <label>Tempo estimado <input type="number" min="1" max="480" value={task.estimate} onChange={e => changeTask(task.id, x => ({ ...x, estimate: Math.max(1, +e.target.value) }))} /></label>
      <label>Prazo opcional <input type="date" value={task.deadline} onChange={e => changeTask(task.id, x => ({ ...x, deadline: e.target.value }))} /></label>
      <label>Coluna <select value={task.column} onChange={e => changeTask(task.id, x => ({ ...x, column: e.target.value as Column }))}>{columns.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</select></label></div>
      <h3>Slices</h3><div className="slices">{task.slices.map(slice => <label key={slice.id}><input type="checkbox" checked={slice.done} onChange={() => changeTask(task.id, x => ({ ...x, slices: x.slices.map(s => s.id === slice.id ? { ...s, done: !s.done } : s) }))} /><span className={slice.done ? 'done' : ''}>{slice.name}</span></label>)}</div>
      <form onSubmit={e => { e.preventDefault(); if (sliceDraft.trim()) { changeTask(task.id, x => ({ ...x, slices: [...x.slices, { id: id(), name: sliceDraft.trim(), done: false }] })); setSliceDraft(''); } }} className="add-slice"><input placeholder="Nome do slice" value={sliceDraft} onChange={e => setSliceDraft(e.target.value)} /><button>Adicionar</button></form>
      <h3>Iniciar foco</h3><div className="scope"><label><input type="radio" checked={scope === 'whole'} onChange={() => setScope('whole')} /> Tarefa inteira</label><label><input type="radio" checked={scope === 'slices'} onChange={() => setScope('slices')} /> Selecionar slices</label></div>
      {scope === 'slices' && <div className="slices">{task.slices.filter(s => !s.done).map(s => <label key={s.id}><input type="checkbox" checked={selectedSlices.includes(s.id)} onChange={() => setSelectedSlices(old => old.includes(s.id) ? old.filter(v => v !== s.id) : [...old, s.id])} />{s.name}</label>)}</div>}
      <p className="summary">{minutes(task.focusSeconds)} de foco registrado · {task.failures} tentativas falhas</p>
      {task.column === 'done' && <p className="summary">Concluída em {displayDate(task.completedAt)}{task.archivedAt ? ` · arquivada em ${displayDate(task.archivedAt)}` : ''}</p>}
      {!!task.attachments?.length && <><h3>Anexos</h3><div className="task-attachments">{task.attachments.map((link, index) => <a key={index} href={link.url} target="_blank" rel="noopener noreferrer">{link.title} ↗</a>)}</div></>}
      <div className="task-actions"><button className="primary" disabled={!!active || !!task.archivedAt} onClick={() => { startFocus(task); if (!active) setSelectedTask(null); }}>Iniciar ciclo de {task.estimate} min</button>
        {task.column === 'done' && !task.archivedAt && <button onClick={() => archiveTask(task)}>Arquivar concluída</button>}
        {task.archivedAt && <button onClick={() => { changeTask(task.id, current => ({ ...current, archivedAt: undefined })); setSelectedTask(null); setToast('Tarefa restaurada para o quadro.'); }}>Restaurar</button>}
        <button className="delete-task" onClick={() => deleteTask(task)}>Apagar tarefa</button></div>
    </section></div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
