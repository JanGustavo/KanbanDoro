import { useState } from 'react';

export type Destination = 'calendar' | 'tasks' | 'email';
export type ConnectionDraft = { title: string; description: string; start: string; end: string; to: string; subject: string; body: string };

export default function ConnectionProposal({ kind, initial, listId, onClose, onSuccess }: {
  kind: Destination; initial: ConnectionDraft; listId: string; onClose: () => void; onSuccess: (message: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function edit(field: keyof ConnectionDraft, value: string) { setDraft(old => ({ ...old, [field]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    let body: object;
    let type: string;
    if (kind === 'calendar') {
      const start = new Date(draft.start);
      const end = new Date(draft.end);
      if (!draft.title.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        return setError('Revise título, início e término do evento.');
      }
      type = 'CALENDAR_CREATE';
      body = { title: draft.title.trim(), description: draft.description, start: start.toISOString(), end: end.toISOString() };
    } else if (kind === 'tasks') {
      if (!listId || !draft.title.trim()) return setError('Escolha uma lista e informe o título da tarefa.');
      type = 'TASKS_CREATE'; body = { title: draft.title.trim(), notes: draft.description };
    } else {
      if (!draft.to.trim() || !draft.subject.trim() || !draft.body.trim()) return setError('Informe destinatário, assunto e mensagem.');
      if (!window.confirm(`Enviar o e-mail para ${draft.to.trim()}? Confira o conteúdo antes de confirmar.`)) return;
      type = 'GMAIL_SEND'; body = { to: draft.to.trim(), subject: draft.subject.trim(), body: draft.body };
    }
    setBusy(true);
    try {
      const result = await chrome.runtime.sendMessage({ type, listId, draft: body }) as { id?: string; error?: string };
      if (result.error || !result.id) throw Error(result.error || 'O Google não confirmou a operação.');
      onSuccess(kind === 'email' ? 'E-mail enviado e confirmado pelo Gmail.' : kind === 'calendar' ? 'Evento criado no Google Calendar.' : 'Tarefa criada no Google Tasks.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.'); }
    finally { setBusy(false); }
  }
  return <section className="connection-review" aria-label="Revisar proposta">
    <span className="eyebrow">PROPOSTA · REVISÃO OBRIGATÓRIA</span>
    <h3>{kind === 'calendar' ? 'Novo evento' : kind === 'tasks' ? 'Nova tarefa no Google Tasks' : 'Novo e-mail'}</h3>
    <p>Confira e edite os campos. O Google só recebe os dados quando você confirmar.</p>
    <form onSubmit={event => void submit(event)} className="connection-review-form">
      {kind !== 'email' ? <>
        <label>Título<input required maxLength={180} value={draft.title} onChange={event => edit('title', event.target.value)} /></label>
        <label>Descrição<textarea maxLength={4000} value={draft.description} onChange={event => edit('description', event.target.value)} /></label>
        {kind === 'calendar' && <div className="connection-dates"><label>Começa em<input required type="datetime-local" value={draft.start} onChange={event => edit('start', event.target.value)} /></label>
          <label>Termina em<input required type="datetime-local" value={draft.end} onChange={event => edit('end', event.target.value)} /></label></div>}
        {kind === 'tasks' && <small>Lista selecionada no Google Tasks: {listId || 'carregue uma lista antes de confirmar'}</small>}
      </> : <>
        <label>Para<input required type="email" value={draft.to} onChange={event => edit('to', event.target.value)} /></label>
        <label>Assunto<input required maxLength={250} value={draft.subject} onChange={event => edit('subject', event.target.value)} /></label>
        <label>Mensagem<textarea required maxLength={10000} value={draft.body} onChange={event => edit('body', event.target.value)} /></label>
      </>}
      {error && <p role="alert" className="warning">{error}</p>}
      <div className="connection-review-actions"><button type="button" onClick={onClose} disabled={busy}>Descartar proposta</button>
        <button className="primary" disabled={busy}>{busy ? 'Enviando…' : kind === 'email' ? 'Revisar e enviar e-mail' : kind === 'calendar' ? 'Confirmar e criar evento' : 'Confirmar e criar tarefa'}</button></div>
    </form>
  </section>;
}
