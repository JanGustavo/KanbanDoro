import { useEffect, useState } from 'react';

const amounts = [5, 10, 20];

export default function SupportPix({ onClose, soundEnabled }: { onClose: () => void; soundEnabled: boolean }) {
  const [amount, setAmount] = useState(5);
  const [custom, setCustom] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [payment, setPayment] = useState<{ payload: string; qrCode: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [thanks, setThanks] = useState(false);
  const validAmount = Number.isFinite(amount) && amount >= 1 && amount <= 99999.99;

  useEffect(() => {
    setPayment(null);
    setCopied(false);
    setError('');
    if (!validAmount) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const config = await fetch(chrome.runtime.getURL('connections-config.json'), { signal: controller.signal });
        const { apiUrl } = (await config.json()) as { apiUrl?: string };
        if (!apiUrl) throw Error('A API de apoio ainda não está configurada nesta instalação.');
        const response = await fetch(`${apiUrl}/support/pix?amount=${amount.toFixed(2)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { payload?: string; qrCode?: string; detail?: string };
        if (!response.ok || !data.payload || !data.qrCode) throw Error(data.detail || 'Não foi possível gerar o Pix.');
        setPayment({ payload: data.payload, qrCode: data.qrCode });
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o Pix.');
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [amount, validAmount]);

  async function copy() {
    if (!payment) return;
    try {
      await navigator.clipboard.writeText(payment.payload);
      setCopied(true);
    } catch {
      setError('Não foi possível copiar. Tente novamente.');
    }
  }

  function acknowledge() {
    setThanks(true);
    if (soundEnabled) void chrome.runtime.sendMessage({ type: 'CELEBRATE_SOUND' }).catch(() => {});
  }

  return (
    <div className="backdrop support-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      {thanks && (
        <div className="cycle-confetti" aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => (
            <span
              key={index}
              style={{ left: `${(index * 37) % 97}%`, animationDelay: `${((index * 7) % 13) * 0.07}s` }}
            />
          ))}
        </div>
      )}
      <section className="dialog support-pix" role="dialog" aria-modal="true" aria-label="Apoie o KanbanDoro">
        <button className="close" onClick={onClose} aria-label="Fechar apoio">
          ✕
        </button>
        {thanks ? (
          <div className="support-thanks">
            <span className="support-heart" aria-hidden="true">
              ♥
            </span>
            <h2>Obrigado pelo apoio!</h2>
            <p>Seu gesto ajuda a manter o KanbanDoro em movimento.</p>
            <p className="support-caption">O pagamento não é verificado automaticamente aqui.</p>
            <button className="primary" onClick={onClose}>
              Voltar ao quadro
            </button>
          </div>
        ) : (
          <>
            <span className="support-heart" aria-hidden="true">
              ♥
            </span>
            <span className="eyebrow">APOIO VOLUNTÁRIO</span>
            <h2>Apoie o KanbanDoro</h2>
            <p>Ajude a manter o projeto e seus serviços. Escolha um valor para gerar um Pix.</p>
            <div className="support-values" role="group" aria-label="Escolha o valor">
              {amounts.map(value => (
                <button
                  key={value}
                  className={!isCustom && amount === value ? 'selected' : ''}
                  aria-pressed={!isCustom && amount === value}
                  onClick={() => {
                    setIsCustom(false);
                    setAmount(value);
                    setCopied(false);
                  }}
                >
                  R$ {value}
                </button>
              ))}
              <button
                className={isCustom ? 'selected' : ''}
                aria-pressed={isCustom}
                onClick={() => {
                  setIsCustom(true);
                  setAmount(Number(custom.replace(',', '.')));
                  setCopied(false);
                }}
              >
                Outro valor
              </button>
            </div>
            {isCustom && (
              <label className="support-custom">
                Valor em reais (mínimo R$ 1)
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex.: 12,50"
                  value={custom}
                  onChange={event => {
                    const next = event.target.value;
                    if (/^\d{0,5}(?:[,.]\d{0,2})?$/.test(next)) {
                      setCustom(next);
                      setAmount(Number(next.replace(',', '.')));
                      setCopied(false);
                    }
                  }}
                />
              </label>
            )}
            <div className="support-qr" aria-live="polite">
              {!validAmount ? (
                <p>Informe um valor entre R$ 1 e R$ 99.999,99.</p>
              ) : error ? (
                <p role="alert">{error}</p>
              ) : payment ? (
                <img src={payment.qrCode} alt={`QR Code Pix de R$ ${amount.toFixed(2).replace('.', ',')}`} />
              ) : (
                <p>Gerando Pix…</p>
              )}
            </div>
            {payment && (
              <button className="support-copy" onClick={() => void copy()}>
                {copied ? 'Código copiado ✓' : 'Copiar Pix Copia e Cola'}
              </button>
            )}
            <small>Confira o destinatário e o valor no aplicativo do seu banco antes de pagar.</small>
            {payment && (
              <button className="support-ack" onClick={acknowledge}>
                Já contribuí · agradecer
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
