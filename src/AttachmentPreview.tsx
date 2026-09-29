export type AttachmentInfo = {
  title: string;
  url: string;
  verifiedAt: number | null;
  reason: string;
  pageTitle?: string;
  description?: string;
  source?: string;
  summary?: string;
};

export default function AttachmentPreview({
  link,
  busy,
  error,
  onSummarize,
}: {
  link: AttachmentInfo;
  busy: boolean;
  error?: string;
  onSummarize: () => void;
}) {
  const host = (() => {
    try {
      return new URL(link.url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const video = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host);
  const repository =
    host === 'github.com' &&
    /^\/[\w.-]+\/[\w.-]+\/?$/.test(
      (() => {
        try {
          return new URL(link.url).pathname;
        } catch {
          return '';
        }
      })(),
    );
  const kind = video ? 'Vídeo' : repository ? 'Repositório' : 'Artigo ou documentação';
  return (
    <div className="source-preview">
      <div className="source-preview-icon" aria-hidden="true">
        {video ? '▶' : repository ? '⌘' : '↗'}
      </div>
      <div className="source-preview-body">
        <span className="source-preview-origin">
          {kind} · {link.source || host || 'Fonte externa'}
        </span>
        <strong>{link.pageTitle || link.title || 'Link sem título'}</strong>
        <p>
          {link.description ||
            (link.verifiedAt
              ? 'Link verificado; este site não disponibilizou uma prévia de texto.'
              : link.reason || 'Verifique o link para obter uma prévia.')}
        </p>
        {video && (
          <small className="source-preview-note">
            A verificação confere a página. O resumo do vídeo requer Gemini configurado e só acontece após seu clique.
          </small>
        )}
        {link.summary && (
          <p className="source-preview-summary">
            <b>Resumo com IA:</b> {link.summary}
          </p>
        )}
        {error && (
          <small className="warning" role="alert">
            {error}
          </small>
        )}
        <div className="source-preview-actions">
          {link.verifiedAt && (
            <button type="button" disabled={busy} onClick={onSummarize}>
              {busy
                ? video
                  ? 'Analisando vídeo…'
                  : 'Lendo página…'
                : link.summary
                  ? 'Atualizar resumo'
                  : video
                    ? 'Resumir vídeo com Gemini'
                    : 'Resumir conteúdo'}
            </button>
          )}
          {link.verifiedAt && (
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {video ? 'Assistir vídeo ↗' : repository ? 'Abrir repositório ↗' : 'Abrir fonte ↗'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
