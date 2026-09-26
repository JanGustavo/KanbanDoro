import { useEffect, useState } from 'react';
import GmailConnection, { type GmailMessage } from './GmailConnection';
import CalendarConnection, { type CalendarEvent } from './CalendarConnection';
import TasksConnection, { type GoogleTask } from './TasksConnection';

type Draft = { name: string; description: string; deadline?: string };
export default function Connections({ onClose, onDraft }: { onClose: () => void; onDraft: (draft: Draft) => void }) {
  const [tab, setTab] = useState<'gmail' | 'calendar' | 'tasks'>('gmail');
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let mounted = true;
    chrome.runtime.sendMessage({ type: 'GOOGLE_STATUS' }).then(result => { if (mounted) setStatus(result); })
      .catch(() => { if (mounted) setNotice('Não foi possível verificar a conexão.'); });
    return () => { mounted = false; };
  }, []);
  async function connect(type: 'GOOGLE_CONNECT' | 'GOOGLE_DISCONNECT') {
    setLoading(true); setNotice('');
    try {
      const response = await chrome.runtime.sendMessage({ type }) as { configured: boolean; connected: boolean; error?: string };
      if (response.error) throw Error(response.error);
      setStatus(response);
      setNotice(type === 'GOOGLE_CONNECT' ? 'Conta conectada.' : 'Conta desconectada.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha de conexão.'); }
    finally { setLoading(false); }
  }
  return <div className="backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog connection-dialog" role="dialog" aria-modal="true" aria-label="Connections">
      <button className="close" onClick={onClose} aria-label="Fechar Connections">✕</button>
      <span className="eyebrow">CONNECTIONS</span><h2>Dados para o seu quadro</h2>
      {!status ? <p role="status">Verificando conexão…</p> : !status.configured ? <div className="connection-note" role="status">
        Configure um cliente OAuth do tipo Aplicativo da Web e a URL da API. Redirect URI: <code>{chrome.identity.getRedirectURL()}</code>. Consulte o README.
      </div> : status.connected ? <button className="connection-disconnect" disabled={loading} onClick={() => void connect('GOOGLE_DISCONNECT')}>Desconectar conta Google</button>
        : <button className="primary connection-connect" disabled={loading} onClick={() => void connect('GOOGLE_CONNECT')}>{loading ? 'Conectando…' : 'Conectar conta Google'}</button>}
      {notice && <p role="status" className="connection-notice">{notice}</p>}
      <div className="proposal-tabs" role="tablist" aria-label="Conexões Google">
        {(['gmail', 'calendar', 'tasks'] as const).map(key => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{key === 'gmail' ? 'Gmail' : key === 'calendar' ? 'Calendar' : 'Tasks'}</button>)}
      </div>
      {status?.connected && tab === 'gmail' && <GmailConnection onDraft={(message: GmailMessage) => onDraft({ name: message.subject, description: `Mensagem de: ${message.from}\n\n${message.snippet}` })} />}
      {status?.connected && tab === 'calendar' && <CalendarConnection onDraft={(event: CalendarEvent) => onDraft({ name: event.title, description: `Evento: ${event.start} até ${event.end}\n\n${event.description}`, deadline: event.start.slice(0, 10) })} />}
      {status?.connected && tab === 'tasks' && <TasksConnection onDraft={(task: GoogleTask) => onDraft({ name: task.title, description: task.notes, deadline: task.due.slice(0, 10) })} />}
    </section>
  </div>;
}
