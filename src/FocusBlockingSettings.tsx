import { useState, type FormEvent } from 'react';
import {
  blockedDomains,
  focusBlockingDefault,
  gentleDomains,
  groupFocusDomains,
  normalizeDomain,
  strictDomains,
  type BlockingMode,
  type FocusBlocking,
} from './focusBlocking';

export default function FocusBlockingSettings({
  settings: saved,
  onChange,
}: {
  settings: FocusBlocking | null;
  onChange: (next: FocusBlocking) => void;
}) {
  const settings = saved ?? focusBlockingDefault;
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  if (!saved) return <p>Carregando suas preferências de foco…</p>;
  function add(event: FormEvent) {
    event.preventDefault();
    const domain = normalizeDomain(draft);
    if (!domain) {
      setError('Informe um domínio ou URL HTTP/HTTPS válido, sem porta.');
      return;
    }
    const key = settings.mode === 'custom' ? 'customDomains' : 'exceptions';
    onChange({ ...settings, [key]: [...new Set([...settings[key], domain])] });
    setDraft('');
    setError('');
  }
  function select(mode: BlockingMode) {
    onChange({ ...settings, mode });
    setError('');
  }
  const editingCustom = settings.mode === 'custom';
  const domains = editingCustom ? settings.customDomains : settings.mode === 'gentle' ? gentleDomains : strictDomains;
  const categories = groupFocusDomains(domains);
  const blocked = new Set(blockedDomains(settings));
  return (
    <div className="blocking-settings">
      <h3>Modo sem distrações</h3>
      <p className="settings-hint">
        Ativo apenas enquanto o cronômetro está em foco. Mostra uma tela escura por cinco segundos ao abrir um site
        bloqueado e depois abre a nova guia. Durante a pausa, os sites ficam livres. Se preferir, use o tema escuro dos
        sites que você acessa; o KanbanDoro não muda o tema deles.
      </p>
      <div className="blocking-profiles" role="group" aria-label="Perfil de bloqueio">
        {(
          [
            ['off', 'Desligado', 'Navegação livre.'],
            ['gentle', 'Essencial', 'Redes e jogos que costumam interromper o foco.'],
            ['strict', 'Intenso', 'Mais redes, vídeos, jogos e entretenimento.'],
            ['custom', 'Meu perfil', 'Você escolhe os domínios.'],
          ] as const
        ).map(([mode, title, detail]) => (
          <button
            type="button"
            className={`blocking-profile blocking-profile-${mode}${settings.mode === mode ? ' selected' : ''}`}
            aria-pressed={settings.mode === mode}
            key={mode}
            onClick={() => select(mode)}
          >
            <strong>{title}</strong>
            <small>{detail}</small>
          </button>
        ))}
      </div>
      {editingCustom && (
        <div className="blocking-import">
          <span>Começar com os sites de:</span>
          <button type="button" onClick={() => onChange({ ...settings, customDomains: [...gentleDomains] })}>
            Essencial
          </button>
          <button type="button" onClick={() => onChange({ ...settings, customDomains: [...strictDomains] })}>
            Intenso
          </button>
        </div>
      )}
      {settings.mode !== 'off' && (
        <>
          <p className="settings-hint">
            {editingCustom
              ? 'Adicione ou retire domínios deste perfil.'
              : 'Adicione exceções para sites que você precisa usar, como WhatsApp.'}{' '}
            Vale para o domínio e seus subdomínios. {blockedDomains(settings).length} domínio(s) na lista.
          </p>
          <form className="blocking-add" onSubmit={add}>
            <input
              aria-label={editingCustom ? 'Domínio para bloquear' : 'Domínio para liberar'}
              placeholder="Ex.: whatsapp.com ou https://web.whatsapp.com"
              value={draft}
              onChange={event => setDraft(event.target.value)}
            />
            <button className="primary">{editingCustom ? 'Bloquear' : 'Liberar'}</button>
          </form>
          {error && (
            <p role="alert" className="warning">
              {error}
            </p>
          )}
          <div className="blocking-categories" aria-label="Sites por categoria">
            {categories.map(category => (
              <details className="blocking-category" key={category.id}>
                <summary>
                  <span>{category.title}</span>
                  <span className="blocking-category-count">{category.domains.length} sites</span>
                </summary>
                <div className="blocking-list" aria-label={category.title}>
                  {category.domains.map(domain => (
                    <div key={domain}>
                      <span>{domain}</span>
                      {!blocked.has(domain) && <small className="blocking-domain-allowed">Liberado</small>}
                      {editingCustom && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              ...settings,
                              customDomains: settings.customDomains.filter(item => normalizeDomain(item) !== domain),
                            })
                          }
                          aria-label={`Retirar ${domain} do bloqueio`}
                        >
                          Retirar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
            {!categories.length && (
              <p className="settings-hint">
                Nenhum domínio neste perfil. Adicione um site ou importe um dos perfis acima.
              </p>
            )}
          </div>
          {!!settings.exceptions.length && (
            <>
              <h4>Sites liberados</h4>
              <div className="blocking-list">
                {settings.exceptions.map(domain => (
                  <div key={domain}>
                    <span>{domain}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ ...settings, exceptions: settings.exceptions.filter(item => item !== domain) })
                      }
                      aria-label={`Remover exceção ${domain}`}
                    >
                      Retirar exceção
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {editingCustom && (
            <p className="settings-hint">
              Para liberar parte de um site bloqueado, adicione uma exceção no campo abaixo.
            </p>
          )}
          {editingCustom && (
            <form
              className="blocking-add"
              onSubmit={event => {
                event.preventDefault();
                const domain = normalizeDomain(draft);
                if (domain) {
                  onChange({ ...settings, exceptions: [...new Set([...settings.exceptions, domain])] });
                  setDraft('');
                  setError('');
                } else setError('Informe um domínio válido.');
              }}
            >
              <input
                aria-label="Exceção para o perfil personalizado"
                placeholder="Liberar: whatsapp.com"
                value={draft}
                onChange={event => setDraft(event.target.value)}
              />
              <button>Liberar</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
