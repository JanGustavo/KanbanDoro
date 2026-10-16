import { useId, useState } from 'react';
import type { Task } from './main';
import LocalMaterials from './LocalMaterials';
import ResumePointEditor from './ResumePointEditor';
import { saveResumePoint } from './continuity';

export default function FocusTaskMaterials({
  task,
  onChange,
  initialTarget,
}: {
  task: Task;
  initialTarget?: string;
  onChange: (change: (current: Task) => Task) => void;
}) {
  const panelId = useId();
  const [target, setTarget] = useState<string | null>(
    () =>
      initialTarget ??
      (task.resumePoint?.sliceId && task.slices.some(slice => slice.id === task.resumePoint?.sliceId && !slice.done)
        ? task.resumePoint.sliceId
        : null),
  );
  const slice = task.slices.find(item => item.id === target);
  const materials = target === 'task' ? task : slice;
  const label = target === 'task' ? 'Tarefa inteira' : `Etapa ${slice?.name ?? ''}`;
  return (
    <div className="focus-materials">
      <details className="resume-details">
        <summary>Onde parei e próximo passo</summary>
        <ResumePointEditor task={task} onChange={onChange} />
      </details>
      <div className="focus-slice-list" aria-label="Etapas e materiais da tarefa">
        {task.slices.map(item => (
          <div className="focus-slice-row" key={item.id}>
            <button
              type="button"
              className={`slice-toggle-btn ${item.done ? 'finished' : ''}`}
              aria-pressed={item.done}
              aria-label={`${item.done ? 'Reabrir' : 'Concluir'} etapa ${item.name}`}
              onClick={() => {
                onChange(current => ({
                  ...current,
                  slices: current.slices.map(value => (value.id === item.id ? { ...value, done: !value.done } : value)),
                }));
                if (!item.done) setTarget(item.id);
              }}
            >
              {item.name}
              {item.done ? ' ✓' : ''}
            </button>
            <button
              type="button"
              className="focus-materials-button"
              aria-expanded={target === item.id}
              aria-controls={panelId}
              onClick={() => {
                setTarget(old => (old === item.id ? null : item.id));
                if (!item.done) onChange(current => saveResumePoint(current, { sliceId: item.id }, Date.now()));
              }}
            >
              Anexar / anotar<span className="sr-only"> na etapa {item.name}</span>
              {!!item.files?.length && ` · ${item.files.length} arquivo(s)`}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="focus-materials-button"
        aria-expanded={target === 'task'}
        aria-controls={panelId}
        onClick={() => setTarget(old => (old === 'task' ? null : 'task'))}
      >
        Materiais da tarefa inteira{task.files?.length ? ` · ${task.files.length} arquivo(s)` : ''}
      </button>
      <div id={panelId}>
        {materials && (
          <section className="focus-materials-panel" aria-label={`Materiais: ${label}`}>
            <div className="focus-materials-heading">
              <strong>
                {label}
                {slice?.done ? ' · concluída' : ''}
              </strong>
              <button type="button" aria-label="Fechar materiais do foco" onClick={() => setTarget(null)}>
                ✕
              </button>
            </div>
            <LocalMaterials
              key={target}
              label={label}
              notes={materials.notes ?? ''}
              files={materials.files ?? []}
              onNotes={notes =>
                onChange(current =>
                  target === 'task'
                    ? { ...current, notes }
                    : {
                        ...current,
                        slices: current.slices.map(value => (value.id === target ? { ...value, notes } : value)),
                      },
                )
              }
              onFiles={change =>
                onChange(current =>
                  target === 'task'
                    ? { ...current, files: change(current.files ?? []) }
                    : {
                        ...current,
                        slices: current.slices.map(value =>
                          value.id === target ? { ...value, files: change(value.files ?? []) } : value,
                        ),
                      },
                )
              }
            />
          </section>
        )}
      </div>
    </div>
  );
}
