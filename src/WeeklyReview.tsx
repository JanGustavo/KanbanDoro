import { useState } from 'react';
import { weeklyReview, weeklyAIPayload } from './weeklyReview';
import { dateFromDay, localDay, weekStart } from './schedule';
import { getAISettings, waitForAISettingsSave, AI_PROVIDERS } from './aiSettings';
import AIIcon from './AIIcon';

const historyLabels: Record<string, string> = {
  completed: 'Concluída',
  failed: 'Não concluída',
  interrupted: 'Interrompida',
  switched: 'Avançou no ciclo',
  'cycle-completed': 'Ciclo concluído',
};
type Props = Parameters<typeof weeklyReview>;
export default function WeeklyReview({ tasks, history, now }: { tasks: Props[0]; history: Props[1]; now: number }) {
  const [week, setWeek] = useState(() => weekStart(new Date(now)));
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<{ summary: string; adjustments: string[]; nextStep: string } | null>(null);
  const [analyzedInput, setAnalyzedInput] = useState('');
  const [model, setModel] = useState('');
  const review = weeklyReview(tasks, history, week, now);
  const previousDay = dateFromDay(review.week);
  previousDay.setDate(previousDay.getDate() - 7);
  const previous = weeklyReview(tasks, history, localDay(previousDay), now);
  const payload = weeklyAIPayload(review, previous);
  const serialized = JSON.stringify(payload);
  const active = analysis && analyzedInput === serialized;
  async function analyze() {
    setBusy(true);
    setError('');
    setAnalysis(null);
    const requested = serialized;
    try {
      await waitForAISettingsSave();
      const settings = await getAISettings();
      const response = (await chrome.runtime.sendMessage({ type: 'AI_WEEKLY_REVIEW', data: payload })) as
        { review?: NonNullable<typeof analysis>; error?: string } | undefined;
      if (!response?.review || response.error) throw Error(response?.error || 'A IA não retornou uma análise.');
      setAnalysis(response.review);
      setAnalyzedInput(requested);
      setModel(`${AI_PROVIDERS[settings.provider as keyof typeof AI_PROVIDERS]} · ${settings.model}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível analisar.');
    } finally {
      setBusy(false);
    }
  }
  function changeWeek(value: string) {
    setWeek(weekStart(dateFromDay(value)));
    setPreview(false);
    setAnalysis(null);
    setError('');
  }
  return (
    <section className="weekly-review stats-section" aria-label="Revisão semanal e histórico">
      <header className="weekly-heading">
        <div>
          <span className="eyebrow">REVISÃO SEMANAL</span>
          <h3>O que avançou e o que ajustar</h3>
        </div>
        <label>
          Semana de{' '}
          <input
            type="date"
            value={week}
            max={localDay(new Date(now))}
            disabled={busy}
            onChange={event => {
              if (event.target.value) changeWeek(event.target.value);
            }}
          />
        </label>
      </header>
      <p className="stats-note">
        Semana iniciada em {dateFromDay(review.week).toLocaleDateString('pt-BR')}. Pendências mostram o estado atual do
        quadro; conclusões e foco são do período selecionado.
      </p>
      <div className="stats-summary">
        <article>
          <span>Concluídas no período</span>
          <strong>{review.completed.length}</strong>
          <small>Semana anterior: {previous.completed.length}</small>
        </article>
        <article>
          <span>Foco na semana</span>
          <strong>{Math.round(review.focusSeconds / 60)} min</strong>
          <small>Anterior: {Math.round(previous.focusSeconds / 60)} min</small>
        </article>
        <article>
          <span>Pendentes agora</span>
          <strong>{review.pending.length}</strong>
          <small>{review.stalled.length} iniciadas sem registro desde antes desta semana</small>
        </article>
      </div>
      <div className="review-table-scroll">
        <table>
          <caption>Estimativa total × foco total das tarefas concluídas nesta semana</caption>
          <thead>
            <tr>
              <th>Área</th>
              <th>Amostra</th>
              <th>Planejado</th>
              <th>Realizado</th>
              <th>Revisão</th>
            </tr>
          </thead>
          <tbody>
            {review.areas.map(area => (
              <tr key={area.area}>
                <td>{area.area}</td>
                <td>
                  {area.sample}
                  {area.smallSample ? ' · pequena' : ''}
                </td>
                <td>{Math.round(area.plannedMinutes)} min</td>
                <td>{Math.round(area.actualMinutes)} min</td>
                <td>
                  {area.smallSample
                    ? 'Mais registros antes de concluir'
                    : area.medianRatio > 1.25
                      ? 'Possível subestimativa'
                      : area.medianRatio < 0.75
                        ? 'Possível superestimativa'
                        : 'Sem desvio grande na mediana'}
                </td>
              </tr>
            ))}
            {!review.areas.length && (
              <tr>
                <td colSpan={5}>Sem tarefas concluídas com tempo medido neste período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="stats-note">
        Tempo total inclui foco de semanas anteriores nas tarefas concluídas agora. Registros sem data de conclusão não
        são contados como conclusões semanais. Comparativos refletem os registros ainda presentes, não snapshots
        históricos.
      </p>
      <p className="weekly-suggestion">
        <strong>Uma mudança pequena:</strong> {review.suggestion}
      </p>
      <details>
        <summary>Concluídas e tarefas paradas</summary>
        <h4>Concluídas</h4>
        <ul>
          {review.completed.slice(0, 20).map(task => (
            <li key={task.id}>{task.name ?? 'Tarefa'}</li>
          ))}
        </ul>
        {!review.completed.length && <p>Nenhuma conclusão registrada.</p>}
        <h4>Paradas no quadro atual</h4>
        <ul>
          {review.stalled.slice(0, 20).map(task => (
            <li key={task.id}>{task.name ?? 'Tarefa'}</li>
          ))}
        </ul>
        {!review.stalled.length && <p>Nenhuma tarefa iniciada sem registro recente.</p>}
      </details>
      <details>
        <summary>Histórico de foco desta semana · {review.events.length} registros</summary>
        <ol className="review-history">
          {[...review.events]
            .sort((a, b) => b.at - a.at)
            .slice(0, 50)
            .map((event, index) => (
              <li key={`${event.taskId}-${event.at}-${index}`}>
                <time>{new Date(event.at).toLocaleString('pt-BR')}</time> ·{' '}
                {tasks.find(task => task.id === event.taskId)?.name ?? 'Tarefa'} · {Math.round(event.seconds / 60)} min
                · {historyLabels[event.kind] ?? 'Registro de foco'}
              </li>
            ))}
        </ol>
        {review.events.length > 50 && <p>Mostrando os 50 registros mais recentes. O cálculo considera todos.</p>}
      </details>
      <button
        className="ai-propose"
        type="button"
        disabled={busy}
        onClick={() => {
          setPreview(!preview);
          setError('');
        }}
      >
        <AIIcon /> Revisar semana com IA
      </button>
      {preview && (
        <div className="weekly-ai-preview">
          <h4>Dados que serão enviados</h4>
          <p>
            Somente totais, nomes das áreas e comparação com a semana anterior. Não enviamos nomes ou descrições das
            tarefas, links, anexos nem eventos individuais. O provedor configurado receberá estes dados apenas ao
            confirmar abaixo.
          </p>
          <pre>{JSON.stringify(payload, null, 2)}</pre>
          <button className="ai-propose" disabled={busy} onClick={() => void analyze()}>
            <AIIcon />
            {busy ? 'Analisando…' : 'Enviar estes dados e analisar'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      {active && (
        <article className="weekly-ai-result">
          <span className="eyebrow">SUGESTÃO DA IA · {model}</span>
          <p>{analysis.summary}</p>
          <ul>
            {analysis.adjustments.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <p>
            <strong>Próxima semana:</strong> {analysis.nextStep}
          </p>
          <small>Interpretação para revisão; nenhuma tarefa ou estimativa foi alterada.</small>
        </article>
      )}
      {analysis && !active && (
        <p className="stats-note">
          Os registros mudaram. A análise anterior foi ocultada; confirme os novos dados para analisar novamente.
        </p>
      )}
    </section>
  );
}
