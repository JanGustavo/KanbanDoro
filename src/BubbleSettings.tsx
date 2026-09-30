import { useEffect, useState } from 'react';
import { defaultBubblePreferences, normalizeBubblePreferences, type BubblePreferences } from './bubbleSettings';

export default function BubbleSettings({ active, onClose }: { active: boolean; onClose: () => void }) {
  const [preferences, setPreferences] = useState(defaultBubblePreferences);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    chrome.runtime
      .sendMessage({ type: 'GET_BUBBLE_SETTINGS' })
      .then(result => {
        if (!mounted) return;
        if (result?.error || !result?.preferences) throw Error(result?.error || 'Não foi possível carregar as opções.');
        setPreferences(normalizeBubblePreferences(result.preferences));
        setBusy(false);
      })
      .catch(reason => {
        if (mounted) {
          setError(reason.message);
          setBusy(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function change(next: BubblePreferences) {
    setBusy(true);
    setError('');
    try {
      const result = await chrome.runtime.sendMessage({ type: 'SET_BUBBLE_SETTINGS', preferences: next });
      if (!result?.preferences || result.error) throw Error(result?.error || 'Não foi possível salvar.');
      setPreferences(normalizeBubblePreferences(result.preferences));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog bubble-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bubble-settings-title"
      >
        <button type="button" className="close" onClick={onClose} aria-label="Fechar opções da bolha">
          ✕
        </button>
        <span className="eyebrow">ACESSO AO CICLO</span>
        <h2 id="bubble-settings-title">Bolha do cronômetro</h2>
        <p className="settings-hint">
          Acompanhe o tempo sem voltar ao quadro. Clique na bolha recolhida para expandir e no relógio expandido para
          abrir o ciclo.
        </p>
        <p className="bubble-status" role="status">
          {active
            ? 'Ciclo ativo: as alterações valem para as páginas abertas.'
            : 'Sem ciclo ativo. A bolha aparece quando você iniciar um ciclo.'}
        </p>
        <h3>Exibição</h3>
        <div
          className="slide-tabs"
          role="group"
          aria-label="Exibição da bolha"
          style={
            {
              '--tab-count': 3,
              '--active-index': ['open', 'compact', 'hidden'].indexOf(preferences.mode),
            } as React.CSSProperties
          }
        >
          {(
            [
              ['open', 'Expandida'],
              ['compact', 'Recolhida'],
              ['hidden', 'Oculta'],
            ] as const
          ).map(([mode, label]) => (
            <button
              type="button"
              key={mode}
              disabled={busy}
              aria-pressed={preferences.mode === mode}
              className={preferences.mode === mode ? 'active' : ''}
              onClick={() => void change({ ...preferences, mode })}
            >
              {label}
            </button>
          ))}
        </div>
        <h3>Posição</h3>
        <div
          className="slide-tabs"
          role="group"
          aria-label="Posição da bolha"
          style={{ '--tab-count': 2, '--active-index': preferences.position === 'left' ? 0 : 1 } as React.CSSProperties}
        >
          {(['left', 'right'] as const).map(position => (
            <button
              type="button"
              key={position}
              disabled={busy}
              aria-pressed={preferences.position === position}
              className={preferences.position === position ? 'active' : ''}
              onClick={() => void change({ ...preferences, position })}
            >
              {position === 'left' ? 'Esquerda' : 'Direita'}
            </button>
          ))}
        </div>
        <small className="settings-hint">
          As opções são lembradas nas próximas abas e ciclos. Páginas internas do navegador não permitem a bolha.
        </small>
        {error && (
          <p className="warning" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
