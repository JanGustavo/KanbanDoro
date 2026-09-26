import { useState } from 'react';

export type CalendarEvent = { id: string; title: string; description: string; start: string; end: string };
const today = () => new Date().toLocaleDateString('en-CA');

export default function CalendarConnection({ onDraft }: { onDraft: (event: CalendarEvent) => void }) {
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  async function search() {
    setLoading(true); setNotice('');
    try {
      const from = new Date(`${start}T00:00:00`);
      const to = new Date(`${end}T00:00:00`);
      to.setDate(to.getDate() + 1);
      if (!start || !end || to <= from || to.getTime() - from.getTime() > 32 * 86400000) throw Error('Escolha um período válido de até 31 dias.');
      const result = await chrome.runtime.sendMessage({ type: 'CALENDAR_EVENTS', start: from.toISOString(), end: to.toISOString() }) as { events?: CalendarEvent[]; error?: string };
      if (result.error) throw Error(result.error);
      setEvents(result.events ?? []);
      if (!result.events?.length) setNotice('Nenhum evento encontrado nesse período.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível consultar a agenda.'); }
    finally { setLoading(false); }
  }
  return <section className="connection-pane" aria-label="Google Calendar"><h2>Google Calendar</h2><p>Escolha um período e consulte os eventos quando quiser.</p>
    <form className="connection-search" onSubmit={event => { event.preventDefault(); void search(); }}>
      <div className="connection-dates"><label>De<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
        <label>Até<input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
        <button className="primary" disabled={loading}>{loading ? 'Consultando…' : 'Buscar eventos'}</button></div>
    </form><div className="connection-messages">{events.map(event => <article key={event.id}>
      <strong>{event.title}</strong><small>{event.start} · {event.end}</small><p>{event.description}</p>
      <button onClick={() => onDraft(event)}>Criar tarefa deste evento</button>
    </article>)}</div>{notice && <p role="status" className="connection-notice">{notice}</p>}
  </section>;
}
