import { useState } from 'react';
import type { Data } from './main';
import { dailyPlan } from './dailyPlan';
import { followingDay, type DayChoice } from './dayClosure';

export default function DayClosing({
  data,
  today,
  onSave,
  onCancel,
}: {
  data: Data;
  today: string;
  onSave: (day: string, choices: Record<string, DayChoice>) => boolean;
  onCancel: () => void;
}) {
  const [day, setDay] = useState(today);
  const [choices, setChoices] = useState<Record<string, DayChoice>>({});
  const [error, setError] = useState('');
  const plan = dailyPlan(data.tasks, day);
  const previous = data.dayClosures.find(item => item.day === day);
  return (
    <div className="backdrop">
      <section className="dialog" role="dialog" aria-modal="true" aria-label="Fechar o dia">
        <button className="close" onClick={onCancel} aria-label="Cancelar fechamento do dia">
          ✕
        </button>
        <span className="eyebrow">FECHAR O DIA</span>
        <h2>Deixe o próximo começo preparado</h2>
        <label>
          Dia do plano
          <input
            type="date"
            max={today}
            value={day}
            onChange={event => {
              setDay(event.target.value);
              setChoices({});
              setError('');
            }}
          />
        </label>
        <p>
          {plan.completed} concluída(s) · {plan.pending.length} pendente(s) · {plan.minutes} min estimados pendentes.
        </p>
        {previous && (
          <p role="status">Já existe um fechamento deste dia. Salvar substitui o resumo com o estado atual do plano.</p>
        )}
        {previous && (
          <details className="closure-record" open>
            <summary>Último fechamento salvo</summary>
            <p>
              {previous.completedTaskIds.length} tarefa(s) concluída(s) · {Math.round(previous.focusSeconds / 60)} min
              de foco registrado no dia · {previous.plannedMinutes} min estimados no plano ao fechar.
            </p>
            <ul>
              {previous.decisions.map(decision => (
                <li key={decision.taskId}>
                  {data.tasks.find(task => task.id === decision.taskId)?.name ?? 'Tarefa removida'}:{' '}
                  {decision.choice === 'tomorrow'
                    ? `planejada para ${followingDay(previous.day)}`
                    : decision.choice === 'backlog'
                      ? 'devolvida à fila'
                      : 'mantida para revisão'}
                </li>
              ))}
            </ul>
            <small>Registro do momento do fechamento. A lista abaixo mostra o estado atual do plano.</small>
          </details>
        )}
        {data.session && <p className="warning">Encerre o ciclo ou a pausa antes de salvar o fechamento.</p>}
        {!plan.ordered.length && <p>Não há tarefas neste plano. Você pode consultar outro dia.</p>}
        {plan.ordered
          .filter(task => task.column === 'done')
          .map(task => (
            <p key={task.id}>✓ {task.name}</p>
          ))}
        {plan.pending.map(task => (
          <label className="closing-task" key={task.id}>
            <strong>{task.name}</strong>
            {task.resumePoint?.nextStep && <small>Próximo passo: {task.resumePoint.nextStep}</small>}
            <select
              aria-label={`Destino de ${task.name}`}
              value={choices[task.id] ?? ''}
              onChange={event => setChoices(old => ({ ...old, [task.id]: event.target.value as DayChoice }))}
            >
              <option value="">Escolha o destino</option>
              <option value="tomorrow">Planejar para {followingDay(day)}</option>
              <option value="backlog">Voltar à fila sem dia marcado</option>
              <option value="keep">Manter neste dia para revisar depois</option>
            </select>
          </label>
        ))}
        {error && (
          <p role="alert" className="warning">
            {error}
          </p>
        )}
        <div className="task-actions">
          <button onClick={onCancel}>Cancelar</button>
          <button
            className="primary"
            disabled={!!data.session || !plan.ordered.length}
            onClick={() => {
              if (plan.pending.some(task => !choices[task.id])) {
                setError('Escolha o destino de cada pendência.');
                return;
              }
              if (!onSave(day, choices)) setError('O plano mudou. Revise as pendências antes de salvar.');
            }}
          >
            Salvar fechamento
          </button>
        </div>
        <p>
          As tarefas são replanejadas sem cópias; arquivos e histórico permanecem na tarefa. Nenhuma pendência é
          transferida sozinha.
        </p>
      </section>
    </div>
  );
}
