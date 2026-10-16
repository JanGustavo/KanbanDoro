import type { Task } from './main';
import { saveResumePoint } from './continuity';

export default function ResumePointEditor({
  task,
  onChange,
}: {
  task: Task;
  onChange: (change: (current: Task) => Task) => void;
}) {
  const save = (change: Parameters<typeof saveResumePoint>[1]) =>
    onChange(current => saveResumePoint(current, change, Date.now()));
  return (
    <fieldset className="resume-editor">
      <legend>Prepare sua retomada</legend>
      <p>Guarde o ponto em que parou e o próximo passo. Fica salvo nesta tarefa.</p>
      {!!task.slices.length && (
        <label>
          Etapa de referência
          <select
            value={task.slices.some(slice => slice.id === task.resumePoint?.sliceId) ? task.resumePoint?.sliceId : ''}
            onChange={event => save({ sliceId: event.target.value || undefined })}
          >
            <option value="">Próxima etapa pendente</option>
            {task.slices.map(slice => (
              <option value={slice.id} key={slice.id}>
                {slice.name}
                {slice.done ? ' · concluída' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Onde parei
        <textarea
          maxLength={2000}
          placeholder="Ex.: terminei a leitura até a página 18."
          value={task.resumePoint?.stoppedAt ?? ''}
          onChange={event => save({ stoppedAt: event.target.value })}
        />
      </label>
      <label>
        Próximo passo
        <textarea
          maxLength={2000}
          placeholder="Ex.: resolver o exercício 4 e conferir a fórmula."
          value={task.resumePoint?.nextStep ?? ''}
          onChange={event => save({ nextStep: event.target.value })}
        />
      </label>
    </fieldset>
  );
}
