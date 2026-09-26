import { useEffect, useState } from 'react';

export type GmailMessage = { id: string; subject: string; from: string; date: string; snippet: string };
type Status = { configured: boolean; connected: boolean; error?: string };

export default function GmailConnection({ onClose, onDraft }: { onClose: () => void; onDraft: (message: GmailMessage) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [query, setQuery] = useState('newer_than:7d');
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    chrome.runtime.sendMessage({ type: 'GMAIL_STATUS' }).then((result: Status) => {
      if (mounted) setStatus(result);
    }).catch(() => { if (mounted) setNotice('Não foi possível consultar o estado da conexão.'); });
    return () => { mounted = false; };
  }, []);

  async function action(type: 'GMAIL_CONNECT' | 'GMAIL_SEARCH' | 'GMAIL_DISCONNECT') {
    setLoading(true); setNotice('');
    try {
      const result = await chrome.runtime.sendMessage({ type, ...(type === 'GMAIL_SEARCH' ? { query } : {}) }) as Status & { messages?: GmailMessage[] };
      if (result.error) throw Error(result.error);
      if (type === 'GMAIL_SEARCH') {
        setMessages(result.messages ?? []);
        if (!result.messages?.length) setNotice('Nenhuma mensagem corresponde à busca.');
      } else {
        setStatus(result); setMessages([]);
        setNotice(type === 'GMAIL_CONNECT' ? 'Gmail conectado. Consulte mensagens quando quiser.' : 'Gmail desconectado desta extensão.');
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao acessar o Gmail.'); }
    finally { setLoading(false); }
  }

  return <div className="backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog connection-dialog" role="dialog" aria-modal="true" aria-label="Connections: Gmail">
      <button className="close" onClick={onClose} aria-label="Fechar Connections">✕</button>
      <span className="eyebrow">CONNECTIONS</span><h2>Gmail</h2>
      <p>Escolha mensagens para criar tarefas. A busca só acontece quando você pedir; seus e-mails não são enviados à IA automaticamente.</p>
      {!status ? <p role="status">Verificando conexão…</p> : !status.configured ? <div className="connection-note" role="status">
        Configure o OAuth do Gmail na compilação da extensão. ID desta extensão: <code>{chrome.runtime.id}</code>.
        Consulte o README para criar o cliente OAuth do tipo extensão do Chrome.
      </div> : status.connected ? <>
        <form className="connection-search" onSubmit={event => { event.preventDefault(); void action('GMAIL_SEARCH'); }}>
          <label htmlFor="gmail-query">Pesquisar no Gmail</label>
          <div><input id="gmail-query" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="newer_than:7d" />
            <button className="primary" disabled={loading} type="submit">{loading ? 'Consultando…' : 'Buscar'}</button></div>
        </form>
        <div className="connection-messages">{messages.map(message => <article key={message.id}>
          <strong>{message.subject}</strong><small>{message.from} · {message.date}</small><p>{message.snippet}</p>
          <button onClick={() => onDraft(message)}>Criar tarefa deste e-mail</button>
        </article>)}</div>
        <button className="connection-disconnect" disabled={loading} onClick={() => void action('GMAIL_DISCONNECT')}>Desconectar Gmail</button>
      </> : <button className="primary connection-connect" disabled={loading} onClick={() => void action('GMAIL_CONNECT')}>{loading ? 'Conectando…' : 'Conectar conta Google'}</button>}
      {notice && <p role="status" className="connection-notice">{notice}</p>}
    </section>
  </div>;
}
