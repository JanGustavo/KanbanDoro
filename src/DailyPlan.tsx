import { useState } from 'react';
import type { Task } from './main';
import { dailyPlan } from './dailyPlan';

export default function DailyPlan({
  tasks,
  day,
  active,
  onPlan,
  onMove,
  onOpen,
  onPrepare,
}: {
  tasks: Task[];
  day: string;
  active: boolean;
  onPlan: (taskId: string, day?: string) => void;
  onMove: (taskId: string, offset: -1 | 1) => void;
  onOpen: (taskId: string) => void;
  onPrepare: (tasks: Task[]) => void;
}) {
  const [chosen, setChosen] = useState('');
  const plan = dailyPlan(tasks, day);
  const candidates = tasks.filter(task => !task.archivedAt && task.column !== 'done' && task.plannedFor !== day);
  const previous = candidates.filter(task => task.plannedFor && task.plannedFor < day).length;
  return (
    <section className="daily-plan" aria-label="Plano para hoje">
      <div className="daily-plan-heading">
        <div>
          <span className="eyebrow">PLANO PARA HOJE</span>
          <h2>Qual é o próximo passo?</h2>
        </div>
        <p>
          {plan.pending.length} pendente(s) · {plan.minutes} min estimados · {plan.completed} concluída(s)
        </p>
      </div>
      <p>
        Escolha uma ordem possível para hoje. O plano reúne todas as áreas; a fila do quadro continua disponível abaixo.
      </p>
      {previous > 0 && (
        <p className="settings-hint">{previous} pendência(s) de planos anteriores. Escolha o que quer retomar hoje.</p>
      )}
      <div className="daily-plan-add">
        <label>
          Adicionar ao plano{' '}
          <select
            value={candidates.some(task => task.id === chosen) ? chosen : ''}
            onChange={e => setChosen(e.target.value)}
          >
            <option value="">Escolha uma tarefa da fila</option>
            {candidates.map(task => (
              <option key={task.id} value={task.id}>
                {task.name} · {task.estimate} min{task.plannedFor ? ` · planejada em ${task.plannedFor}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!candidates.some(task => task.id === chosen)}
          onClick={() => {
            onPlan(chosen, day);
            setChosen('');
          }}
        >
          Planejar hoje
        </button>
      </div>
      {plan.ordered.length ? (
        <ol className="daily-plan-list">
          {plan.ordered.map((task, index) => (
            <li key={task.id} className={task.column === 'done' ? 'daily-plan-done' : ''}>
              <button type="button" className="daily-plan-task" onClick={() => onOpen(task.id)}>
                {task.name}
                {task.column === 'done' ? ' ✓' : ''}
              </button>
              <span>
                {task.estimate} min{task.column === 'late' ? ' · em atraso' : ''}
              </span>
              <div className="daily-plan-actions">
                <button
                  type="button"
                  aria-label={`Subir ${task.name} no plano`}
                  disabled={index === 0}
                  onClick={() => onMove(task.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Descer ${task.name} no plano`}
                  disabled={index === plan.ordered.length - 1}
                  onClick={() => onMove(task.id, 1)}
                >
                  ↓
                </button>
                <button type="button" aria-label={`Retirar ${task.name} do plano`} onClick={() => onPlan(task.id)}>
                  Retirar do plano
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="settings-hint">Seu plano está vazio. Escolha a primeira tarefa para começar.</p>
      )}
      <button
        type="button"
        className="primary"
        disabled={active || !plan.pending.length}
        onClick={() => onPrepare(plan.pending)}
      >
        Montar ciclo com este plano
      </button>
      {active && <small>Encerre o ciclo atual para montar o próximo.</small>}
      <small>
        Retirar do plano mantém a tarefa, os arquivos e o histórico. As estimativas são esforço previsto, não um prazo.
      </small>
    </section>
  );
}
