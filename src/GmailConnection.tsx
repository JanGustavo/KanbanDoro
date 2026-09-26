import { useState } from 'react';

export type GmailMessage = { id: string; subject: string; from: string; date: string; snippet: string };
export default function GmailConnection({ onDraft }: { onDraft: (message: GmailMessage) => void }) {
  const [query, setQuery] = useState('newer_than:7d');
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  async function search() {
    setLoading(true); setNotice('');
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GMAIL_SEARCH', query }) as { messages?: GmailMessage[]; error?: string };
      if (result.error) throw Error(result.error);
      setMessages(result.messages ?? []);
      if (!result.messages?.length) setNotice('Nenhuma mensagem corresponde à busca.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao acessar o Gmail.'); }
    finally { setLoading(false); }
  }

  return <section className="connection-pane" aria-label="Gmail">
      <h2>Gmail</h2>
      <p>Escolha mensagens para criar tarefas. A busca só acontece quando você pedir; seus e-mails não são enviados à IA automaticamente.</p>
        <form className="connection-search" onSubmit={event => { event.preventDefault(); void search(); }}>
          <label htmlFor="gmail-query">Pesquisar no Gmail</label>
          <div><input id="gmail-query" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="newer_than:7d" />
            <button className="primary" disabled={loading} type="submit">{loading ? 'Consultando…' : 'Buscar'}</button></div>
        </form>
        <div className="connection-messages">{messages.map(message => <article key={message.id}>
          <strong>{message.subject}</strong><small>{message.from} · {message.date}</small><p>{message.snippet}</p>
          <button onClick={() => onDraft(message)}>Criar tarefa deste e-mail</button>
        </article>)}</div>

      {notice && <p role="status" className="connection-notice">{notice}</p>}
    </section>;
}
