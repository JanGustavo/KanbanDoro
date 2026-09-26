import { useState, type FormEvent } from 'react';
import type { CalendarEvent } from './CalendarConnection';
import type { GoogleTask } from './TasksConnection';

type Props = {
  kind: 'calendar' | 'tasks';
  item: CalendarEvent | GoogleTask;
  listId?: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

function localDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ConnectionItemEditor({ kind, item, listId, onClose, onChanged }: Props) {
  const calendar = kind === 'calendar' ? item as CalendarEvent : null;
  const task = kind === 'tasks' ? item as GoogleTask : null;
  const allDay = !!calendar && (!calendar.start.includes('T') || !calendar.end.includes('T'));
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(calendar?.description ?? task?.notes ?? '');
  const [start, setStart] = useState(calendar ? localDateTime(calendar.start) : '');
  const [end, setEnd] = useState(calendar ? localDateTime(calendar.end) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const noun = calendar ? 'evento' : 'tarefa';

  async function save(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!title.trim()) return setError('Informe um título.');
    if (calendar && (!start || !end || !Number.isFinite(new Date(start).getTime()) || !Number.isFinite(new Date(end).getTime()) || new Date(end) <= new Date(start))) return setError('Confira o início e o fim do evento.');
    const draft: Record<string, string> = {};
    if (title.trim() !== item.title) draft.title = title.trim();
    if (description !== (calendar?.description ?? task?.notes ?? '')) draft[calendar ? 'description' : 'notes'] = description;
    if (calendar && (start !== localDateTime(calendar.start) || end !== localDateTime(calendar.end))) {
      draft.start = new Date(start).toISOString();
      draft.end = new Date(end).toISOString();
    }
    if (!Object.keys(draft).length) { onClose(); return; }
    setBusy(true);
    try {
      const result = await chrome.runtime.sendMessage({ type: calendar ? 'CALENDAR_UPDATE' : 'TASKS_UPDATE',
        eventId: calendar?.id, taskId: task?.id, listId, draft }) as { id?: string; error?: string };
      if (result.error || !result.id) throw Error(result.error || 'O Google não confirmou a alteração.');
      onClose(); await onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao alterar o item.'); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm(`Excluir “${item.title}” do Google ${calendar ? 'Calendar' : 'Tasks'}? Esta ação pode não ser desfeita.`)) return;
    setBusy(true); setError('');
    try {
      const result = await chrome.runtime.sendMessage({ type: calendar ? 'CALENDAR_DELETE' : 'TASKS_DELETE',
        eventId: calendar?.id, taskId: task?.id, listId }) as { deleted?: boolean; error?: string };
      if (result.error || !result.deleted) throw Error(result.error || 'O Google não confirmou a exclusão.');
      onClose(); await onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao excluir o item.'); }
    finally { setBusy(false); }
  }

  return <div className="backdrop connection-edit-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="dialog connection-editor" role="dialog" aria-modal="true" aria-label={`Editar ${noun} do Google`}>
      <button className="close" type="button" onClick={onClose} disabled={busy} aria-label="Fechar edição">✕</button>
      <span className="eyebrow">GOOGLE {calendar ? 'CALENDAR' : 'TASKS'} · REVISÃO</span><h2>Editar {noun}</h2>
      <p>{allDay ? 'Este evento ocupa o dia inteiro. A edição de eventos sem horário ainda não está disponível; você pode excluí-lo após confirmar.' : 'As alterações só serão enviadas ao Google quando você salvar.'}</p>
      {!allDay && <form onSubmit={event => void save(event)} className="connection-review-form">
        <label>Título<input required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>{calendar ? 'Descrição' : 'Notas'}<textarea maxLength={4000} value={description} onChange={event => setDescription(event.target.value)} /></label>
        {calendar && <div className="connection-dates"><label>Começa em<input required type="datetime-local" value={start} onChange={event => setStart(event.target.value)} /></label>
          <label>Termina em<input required type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} /></label></div>}
        {task?.due && <small>Prazo no Google Tasks: {task.due.slice(0, 10)}. Esta edição preserva o prazo atual.</small>}
        {error && <p role="alert" className="warning">{error}</p>}
        <div className="connection-editor-actions"><button className="delete-task" type="button" disabled={busy} onClick={() => void remove()}>Excluir do Google</button>
          <button className="primary" disabled={busy} type="submit">{busy ? 'Aguarde…' : 'Salvar alterações'}</button></div>
      </form>}
      {allDay && error && <p role="alert" className="warning">{error}</p>}
      {allDay && <div className="connection-editor-actions"><button className="delete-task" type="button" disabled={busy} onClick={() => void remove()}>Excluir do Google Calendar</button></div>}
    </section>
  </div>;
}
