import type { HistoryEntry, Task } from './main';

export default function FirstTaskGuide({
  task,
  history,
  active,
  onCreate,
  onPlan,
  onStart,
  onRecord,
  onDismiss,
}: {
  task?: Task;
  history: HistoryEntry[];
  active: boolean;
  onCreate: () => void;
  onPlan: () => void;
  onStart: () => void;
  onRecord: () => void;
  onDismiss: () => void;
}) {
  const worked =
    !!task && (task.focusSeconds > 0 || history.some(event => event.taskId === task.id && event.seconds > 0));
  const recorded =
    !!task &&
    (!!task.notes?.trim() ||
      !!task.files?.length ||
      !!task.resumePoint?.nextStep.trim() ||
      task.slices.some(slice => !!slice.notes?.trim() || !!slice.files?.length));
  const steps = [!!task, !!task?.plannedFor, worked, recorded];
  const complete = steps.every(Boolean);
  return (
    <aside className="first-task-guide" aria-label="Comece com uma tarefa real">
      <span className="eyebrow">SEU PRIMEIRO FLUXO</span>
      <h2>{complete ? 'Seu primeiro fluxo está registrado' : 'Comece com algo que você precisa fazer'}</h2>
      <p>{task ? task.name : 'Crie uma tarefa sua. Vamos planejar, focar e guardar o resultado com ela.'}</p>
      <ol>
        {[
          'Criar uma tarefa real',
          'Escolher um dia para ela',
          'Registrar tempo de foco',
          'Guardar resultado ou próximo passo',
        ].map((label, index) => (
          <li key={label}>
            {steps[index] ? '✓ ' : ''}
            {label}
          </li>
        ))}
      </ol>
      {!task ? (
        <button className="primary" onClick={onCreate}>
          Criar minha primeira tarefa
        </button>
      ) : !task.plannedFor ? (
        <button className="primary" onClick={onPlan}>
          Planejar esta tarefa para hoje
        </button>
      ) : !worked && task.column !== 'done' ? (
        <button className="primary" disabled={active} onClick={onStart}>
          Começar foco nesta tarefa
        </button>
      ) : !recorded ? (
        <button className="primary" onClick={onRecord}>
          Registrar resultado ou próximo passo
        </button>
      ) : null}
      <button onClick={onDismiss}>{complete ? 'Concluir apresentação' : 'Continuar por conta própria'}</button>
      {active && (
        <p>
          O foco está em andamento. Registre o resultado ou próximo passo nos controles da tarefa; concluir ou
          interromper salva o tempo usado.
        </p>
      )}
      <small>O guia usa sua tarefa e seus registros locais. Você pode sair a qualquer momento.</small>
    </aside>
  );
}
