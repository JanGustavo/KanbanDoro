import { useState } from 'react';
import ConnectionItemEditor from './ConnectionItemEditor';

export type GoogleTask = { id: string; title: string; notes: string; due: string };
type TaskList = { id: string; title: string };

export default function TasksConnection({ onDraft, onListChange }: { onDraft: (task: GoogleTask) => void; onListChange: (listId: string) => void }) {
  const [lists, setLists] = useState<TaskList[]>([]);
  const [listId, setListId] = useState('');
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<GoogleTask | null>(null);
  async function request(type: 'TASKS_LISTS' | 'TASKS_ITEMS') {
    setLoading(true); setNotice('');
    try {
      const result = await chrome.runtime.sendMessage({ type, listId }) as { lists?: TaskList[]; tasks?: GoogleTask[]; error?: string };
      if (result.error) throw Error(result.error);
      if (type === 'TASKS_LISTS') {
        setLists(result.lists ?? []); setListId(result.lists?.[0]?.id ?? ''); onListChange(result.lists?.[0]?.id ?? ''); setTasks([]);
        if (!result.lists?.length) setNotice('Nenhuma lista encontrada.');
      } else {
        setTasks(result.tasks ?? []);
        if (!result.tasks?.length) setNotice('Nenhuma tarefa pendente nessa lista.');
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível consultar as tarefas.'); }
    finally { setLoading(false); }
  }
  return <section className="connection-pane" aria-label="Google Tasks"><h2>Google Tasks</h2><p>Consulte suas listas e escolha uma tarefa para trazer ao quadro.</p>
    <div className="connection-search"><button disabled={loading} onClick={() => void request('TASKS_LISTS')}>Carregar listas</button>
      {lists.length > 0 && <div><select aria-label="Lista do Google Tasks" value={listId} onChange={event => { setListId(event.target.value); onListChange(event.target.value); setTasks([]); }}>
        {lists.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}</select>
        <button className="primary" disabled={loading || !listId} onClick={() => void request('TASKS_ITEMS')}>Ver tarefas</button></div>}</div>
    <div className="connection-messages">{tasks.map(task => <article key={task.id}><strong>{task.title}</strong>
      {task.due && <small>Prazo: {task.due.slice(0, 10)}</small>}<p>{task.notes}</p>
      <div className="connection-item-actions"><button onClick={() => onDraft(task)}>Trazer ao quadro</button><button onClick={() => setEditing(task)}>Editar ou excluir no Google</button></div></article>)}</div>
    {notice && <p role="status" className="connection-notice">{notice}</p>}
    {editing && <ConnectionItemEditor kind="tasks" item={editing} listId={listId} onClose={() => setEditing(null)} onChanged={() => request('TASKS_ITEMS')} />}
  </section>;
}
