import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { getAISettings, setAISettings, AI_PROVIDERS, type AISettings, type ProviderKey } from './aiSettings';

type Column = 'todo' | 'doing' | 'late' | 'done';
type Slice = { id: string; name: string; done: boolean };
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
type Data = { tasks: Task[]; session: Session | null; history: HistoryEntry[]; breakPreferences: string[] };
const columns: { id: Column; label: string }[] = [
  { id: 'todo', label: 'A fazer' }, { id: 'doing', label: 'Em andamento' },
  { id: 'late', label: 'Em atraso' }, { id: 'done', label: 'Concluído' },
];
const initial: Data = { tasks: [], session: null, history: [], breakPreferences: ['Descanso', 'Água', 'Comida', 'Detox'] };
const id = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
const minutes = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;

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

  useEffect(() => {
    chrome.storage.local.get(['tasks', 'session', 'history', 'breakPreferences']).then((stored) => {
      setData({ tasks: (stored.tasks as Task[] | undefined) ?? [], session: (stored.session as Session | undefined) ?? null, history: (stored.history as HistoryEntry[] | undefined) ?? [], breakPreferences: (stored.breakPreferences as string[] | undefined) ?? ['Descanso', 'Água', 'Comida', 'Detox'] });
      setReady(true);
    });
    getAISettings().then(setAiSettings);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (ready) void chrome.storage.local.set(data);
  }, [data, ready]);
  useEffect(() => {
    void setAiSettings(aiSettings);
  }, [aiSettings]);
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
  const doingCount = data.tasks.filter(t => t.column === 'doing').length;

  function changeTask(taskId: string, fn: (item: Task) => Task) {
    update(old => ({ ...old, tasks: old.tasks.map(item => item.id === taskId ? fn(item) : item) }));
  }
  function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const item: Task = { id: id(), name: name.trim(), description: '', difficulty: 1, estimate: 25,
      deadline: '', column: 'todo', failures: 0, focusSeconds: 0, slices: [] };
    update(old => ({ ...old, tasks: [...old.tasks, item] }));
    setName('');
    setSelectedTask(item.id);
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
    update(old => {
      const credited = credit(old, kind);
      const tasks = credited.tasks.map(t => t.id === active.taskId
        ? { ...t, column: kind === 'failed' ? 'late' as Column : kind === 'completed' ? 'done' as Column : t.column,
          failures: t.failures + (kind === 'failed' ? 1 : 0) } : t);
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
  }
  if (!ready) return <main>Carregando KanbanDoro…</main>;

  return <main className="shell">
    <header><div><span className="eyebrow">TRABALHO COM RITMO</span><h1>Kanban<span>Doro</span></h1><p>Organize a tarefa. Dê tempo ao que importa.</p></div><div className="status"><button onClick={() => setShowSettings(true)}>Preferências de pausa</button>{active ? '● Ciclo ativo' : '○ Pronto para começar'}</div></header>
    {error && <p className="warning" role="alert">{error} <button onClick={() => setError('')}>Fechar</button></p>}
    {active && <section className="focus" aria-label="Ciclo atual">
      <div><span className="eyebrow">{phase === 'break' || phase === 'break-done' ? active.breakType : 'FOCO EM ANDAMENTO'}</span>
        <h2>{activeTask?.name ?? 'Tarefa removida'}</h2><small>{active.scope === 'whole' ? 'Tarefa inteira' : `${active.selectedSliceIds.length} slices • tempo compartilhado`}</small></div>
      <strong className="clock">{phase === 'decision' || phase === 'break-done' ? '00:00' : minutes(Math.ceil((active.endsAt - now) / 1000))}</strong>
      <div className="focus-actions">
        {phase === 'running' && <><button onClick={() => stopFocus('completed')}>Concluí</button><button onClick={() => stopFocus('interrupted')}>Interromper e deixar para depois</button><button onClick={() => { stopFocus('interrupted'); if (activeTask) setRestart(activeTask); }}>Interromper e recomeçar</button></>}
        {phase === 'decision' && <><button onClick={() => stopFocus('completed')}>Concluí</button>
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
    <form className="create" onSubmit={addTask}><input aria-label="Nome da tarefa" placeholder="Qual é a próxima tarefa?" value={name} onChange={e => setName(e.target.value)} /><button type="submit">+ Criar tarefa</button></form>
    {showSettings && <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowSettings(false); }}><section className="dialog" role="dialog" aria-modal="true" aria-label="Preferências">
      <button className="close" onClick={() => setShowSettings(false)}>✕</button><span className="eyebrow">PREFERÊNCIAS</span>
      <div className="settings-tabs" role="tablist">
        <button role="tab" aria-selected={settingsTab === 'breaks'} onClick={() => setSettingsTab('breaks')}>Pausas</button>
        <button role="tab" aria-selected={settingsTab === 'ai'} onClick={() => setSettingsTab('ai')}>IA</button>
      </div>
      {settingsTab === 'breaks' && (
        <>
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
          <h3>Integração com IA</h3>
          <p className="settings-hint">Sua chave de API fica salva apenas localmente no navegador (chrome.storage.local).<br />Nunca enviamos sua chave para servidores externos.</p>
          <div className="ai-settings-form">
            <label>
              Provedor
              <select value={aiSettings.provider} onChange={e => setAiSettings((s: AISettings) => ({ ...s, provider: e.target.value as ProviderKey, model: AI_PROVIDERS[e.target.value as ProviderKey]?.defaultModel || '' }))}>
                <option value="">Selecionar provedor</option>
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                  <option key={key} value={key}>{provider.name}</option>
                ))}
              </select>
            </label>
            {aiSettings.provider && (
              <>
                <label>
                  Modelo
                  <select value={aiSettings.model} onChange={e => setAiSettings((s: AISettings) => ({ ...s, model: e.target.value }))}>
                    {AI_PROVIDERS[aiSettings.provider as ProviderKey]?.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {AI_PROVIDERS[aiSettings.provider as ProviderKey] === AI_PROVIDERS.custom && (
                      <option value="">Definir manualmente</option>
                    )}
                  </select>
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
                  <button className="primary" onClick={() => { setAiSettings(aiSettings); }} disabled={!aiSettings.provider || !aiSettings.apiKey || !aiSettings.model}>
                    Salvar configuração
                  </button>
                  {aiSettings.apiKey && (
                    <button className="danger" onClick={() => setAiSettings({ provider: '', apiKey: '', model: '', customEndpoint: '' })}>
                      Remover chave
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section></div>}
    <div className="board">{columns.map(column => <section className="lane" key={column.id}>
      <h2>{column.label} <span>{data.tasks.filter(t => t.column === column.id).length}</span></h2>
      {column.id === 'doing' && doingCount > 5 && <p className="warning">WIP acima de 5. Vale revisar a capacidade antes de assumir outra tarefa.</p>}
      {data.tasks.filter(t => t.column === column.id).map(item => <article className="card" key={item.id}>
        <button className="card-title" onClick={() => { setSelectedTask(item.id); setScope('whole'); setSelectedSlices([]); }}>{item.name}</button>
        <div className="meta"><span>Dificuldade {item.difficulty}</span><span>{item.estimate} min</span>{item.deadline && <span>{item.deadline}</span>}</div>
        <div className="slice-strip">{item.slices.map(slice => <span className={slice.done ? 'slice done' : 'slice'} key={slice.id}>{slice.name}</span>)}</div>
      </article>)}</section>)}</div>
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
      <button className="primary" disabled={!!active} onClick={() => { startFocus(task); if (!active) setSelectedTask(null); }}>Iniciar ciclo de {task.estimate} min</button>
    </section></div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
