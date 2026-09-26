import { useEffect, useState } from 'react';
import GmailConnection, { type GmailMessage } from './GmailConnection';
import CalendarConnection, { type CalendarEvent } from './CalendarConnection';
import TasksConnection, { type GoogleTask } from './TasksConnection';
import ConnectionProposal, { type ConnectionDraft, type Destination } from './ConnectionProposal';

type Draft = { name: string; description: string; deadline?: string };
export default function Connections({ onClose, onDraft }: { onClose: () => void; onDraft: (draft: Draft) => void }) {
  const [tab, setTab] = useState<'gmail' | 'calendar' | 'tasks'>('gmail');
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; needsReconnect?: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [listId, setListId] = useState('');
  const [proposal, setProposal] = useState<{ kind: Destination; draft: ConnectionDraft } | null>(null);
  const emptyDraft = (): ConnectionDraft => ({ title: '', description: '', start: '', end: '', to: '', subject: '', body: '' });
  async function propose() {
    if (!prompt.trim()) return setNotice('Descreva o que deseja criar.');
    setAiBusy(true); setNotice('');
    try {
      const kind: Destination = tab === 'gmail' ? 'email' : tab;
      const response = await chrome.runtime.sendMessage({ type: 'GROQ_CONNECTION_PROPOSAL', kind, prompt, now: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) as { draft?: ConnectionDraft; error?: string };
      if (response.error || !response.draft) throw Error(response.error || 'A IA não retornou uma proposta.');
      setProposal({ kind, draft: response.draft });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível consultar a IA.'); }
    finally { setAiBusy(false); }
  }
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
      setStatus(response); setProposal(null);
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
      </div> : status.connected ? <div className="connection-account">{status.needsReconnect && <span role="status">Novas permissões necessárias para criar eventos, tarefas e enviar e-mails.</span>}
        <button disabled={loading} onClick={() => void connect('GOOGLE_CONNECT')}>Atualizar permissões</button>
        <button className="connection-disconnect" disabled={loading} onClick={() => void connect('GOOGLE_DISCONNECT')}>Desconectar conta Google</button></div>
        : <button className="primary connection-connect" disabled={loading} onClick={() => void connect('GOOGLE_CONNECT')}>{loading ? 'Conectando…' : 'Conectar conta Google'}</button>}
      {(notice || status?.error) && <p role="status" className="connection-notice">{notice || status?.error}</p>}
      <div className="proposal-tabs" role="tablist" aria-label="Conexões Google">
        {(['gmail', 'calendar', 'tasks'] as const).map(key => <button key={key} role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setProposal(null); setPrompt(''); }}>{key === 'gmail' ? 'Gmail' : key === 'calendar' ? 'Calendar' : 'Tasks'}</button>)}
      </div>
      {status?.connected && <section className="connection-assistant" aria-label="Assistente de propostas">
        <span className="eyebrow">ASSISTENTE DE IA</span><h3>{tab === 'gmail' ? 'Escrever e-mail' : tab === 'calendar' ? 'Criar evento' : 'Criar tarefa no Google Tasks'}</h3>
        <label htmlFor="connection-prompt">Descreva o que você quer preparar</label>
        <textarea id="connection-prompt" value={prompt} onChange={event => setPrompt(event.target.value)}
          placeholder={tab === 'gmail' ? 'Ex.: prepare um e-mail para a pessoa informada no pedido…' : tab === 'calendar' ? 'Ex.: reunião amanhã às 14h por uma hora…' : 'Ex.: estudar Linux com três pontos no texto…'} />
        <div className="connection-assistant-actions"><button type="button" disabled={aiBusy || !prompt.trim()} onClick={() => void propose()}>{aiBusy ? 'Preparando…' : 'Propor com IA'}</button>
          <button type="button" onClick={() => setProposal({ kind: tab === 'gmail' ? 'email' : tab, draft: emptyDraft() })}>Preencher manualmente</button></div>
        <small>A IA só usa o texto que você digitar aqui. Revise a proposta antes de gravar no Google. Para Google Tasks, escolha uma lista antes de confirmar.</small>
      </section>}
      {proposal && <ConnectionProposal key={proposal.kind + JSON.stringify(proposal.draft)} kind={proposal.kind} initial={proposal.draft} listId={listId}
        onClose={() => setProposal(null)} onSuccess={message => { setProposal(null); setNotice(message); }} />}
      {status?.connected && tab === 'gmail' && <GmailConnection onDraft={(message: GmailMessage) => onDraft({ name: message.subject, description: `Mensagem de: ${message.from}\n\n${message.snippet}` })} />}
      {status?.connected && tab === 'calendar' && <CalendarConnection onDraft={(event: CalendarEvent) => onDraft({ name: event.title, description: `Evento: ${event.start} até ${event.end}\n\n${event.description}`, deadline: event.start.slice(0, 10) })} />}
      {status?.connected && tab === 'tasks' && <TasksConnection onListChange={setListId} onDraft={(task: GoogleTask) => onDraft({ name: task.title, description: task.notes, deadline: task.due.slice(0, 10) })} />}
    </section>
  </div>;
}
