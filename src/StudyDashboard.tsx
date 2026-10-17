import { useState } from 'react';
import type { HistoryEntry, Task } from './main';
import { localDay } from './schedule';
import { nextStudyDay, studySecondsToday, type RecallRating, type StudyReview } from './studyMode';

const ratingLabels: Array<[RecallRating, string]> = [
  ['again', 'Não lembrei'],
  ['hard', 'Com esforço'],
  ['good', 'Lembrei'],
  ['easy', 'Fácil'],
];

export default function StudyDashboard({
  tasks,
  history,
  reviews,
  today,
  goalMinutes,
  examDate,
  active,
  onStartReview,
  onRate,
}: {
  tasks: Task[];
  history: HistoryEntry[];
  reviews: StudyReview[];
  today: string;
  goalMinutes: number;
  examDate?: string;
  active: boolean;
  onStartReview: (task: Task) => void;
  onRate: (reviewId: string, rating: RecallRating, recall: string) => void;
}) {
  const [recall, setRecall] = useState<Record<string, string>>({});
  const studiedSeconds = studySecondsToday(history, today);
  const targetSeconds = Math.max(15, goalMinutes) * 60;
  const progress = Math.min(100, Math.round((studiedSeconds / targetSeconds) * 100));
  const examDays = examDate
    ? Math.ceil((Date.parse(`${examDate}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000)
    : null;
  const available = new Map(tasks.filter(task => !task.archivedAt).map(task => [task.id, task]));
  const subjectFocus = new Map<string, number>();
  const weekStart = nextStudyDay(today, -6);
  for (const entry of history) {
    if (entry.workflowProfile !== 'study' || !Number.isFinite(entry.at)) continue;
    const day = localDay(new Date(entry.at));
    const task = available.get(entry.taskId);
    if (task && day >= weekStart && day <= today && Number.isFinite(entry.seconds) && entry.seconds > 0) {
      const subject = task.skill?.trim() || 'Sem matéria';
      subjectFocus.set(subject, (subjectFocus.get(subject) ?? 0) + entry.seconds);
    }
  }
  const subjectRows = [...subjectFocus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxSubjectSeconds = Math.max(1, ...subjectRows.map(([, seconds]) => seconds));
  const due = reviews
    .filter(review => review.dueDate <= today && available.has(review.taskId))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = reviews
    .filter(
      review => review.dueDate > today && review.dueDate <= nextStudyDay(today, 7) && available.has(review.taskId),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  return (
    <section className="study-dashboard" aria-label="Plano de estudo">
      <div className="study-dashboard-heading">
        <div>
          <span className="eyebrow">MODO ESTUDO</span>
          <h2>Estude, lembre, revise</h2>
          <p>Matéria por área, tópico por tarefa. Só o foco registrado no perfil Estudo conta para esta meta.</p>
        </div>
        {examDays !== null && (
          <strong className="study-exam-countdown">
            {examDays < 0 ? 'Data da prova passou' : examDays === 0 ? 'Prova hoje' : `${examDays} dias para a prova`}
          </strong>
        )}
      </div>
      <div className="study-goal" aria-label={`Meta diária: ${progress}%`}>
        <div className="study-goal-copy">
          <strong>{Math.floor(studiedSeconds / 60)} min</strong>
          <span>de {goalMinutes} min hoje</span>
          <span>
            {progress >= 100
              ? 'Meta diária alcançada'
              : `Faltam ${Math.max(0, goalMinutes - Math.floor(studiedSeconds / 60))} min`}
          </span>
        </div>
        <div
          className="study-goal-track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      {subjectRows.length > 0 && (
        <div className="study-subject-focus">
          <h3>Foco por matéria · últimos 7 dias</h3>
          {subjectRows.map(([subject, seconds]) => (
            <div className="study-subject-row" key={subject}>
              <span>{subject}</span>
              <div className="study-subject-track">
                <span style={{ width: `${Math.max(3, Math.round((seconds / maxSubjectSeconds) * 100))}%` }} />
              </div>
              <small>{Math.round(seconds / 60)} min</small>
            </div>
          ))}
        </div>
      )}
      <div className="study-review-section">
        <div className="study-review-heading">
          <h3>Revisões para hoje</h3>
          <span>{due.length}</span>
        </div>
        {!!due.length && (
          <p className="study-review-guidance">
            Na primeira revisão: amanhã, 3 dias ou 7 dias, conforme sua lembrança. Depois, intervalos bons aumentam; se
            não lembrar, o tópico volta amanhã.
          </p>
        )}
        {due.length ? (
          <div className="study-review-list">
            {due.map(review => {
              const task = available.get(review.taskId)!;
              return (
                <article className="study-review-card" key={review.id}>
                  <div>
                    <small>
                      {task.skill || 'Sem matéria'} ·{' '}
                      {review.dueDate < today ? `vencida desde ${review.dueDate}` : 'vence hoje'}
                    </small>
                    <strong>{task.name}</strong>
                    {review.lastRecall && <p>Última lembrança: {review.lastRecall}</p>}
                  </div>
                  <label>
                    Tente explicar o tópico de memória
                    <textarea
                      maxLength={2000}
                      value={recall[review.id] ?? ''}
                      placeholder="Anote o que conseguiu recuperar, sem consultar o material…"
                      onChange={event => setRecall(old => ({ ...old, [review.id]: event.target.value }))}
                    />
                  </label>
                  <div className="study-review-actions">
                    <button disabled={active} onClick={() => onStartReview(task)}>
                      Revisar com foco · {Math.min(25, task.estimate)} min
                    </button>
                    {ratingLabels.map(([rating, label]) => (
                      <button
                        className={rating === 'good' ? 'primary' : ''}
                        disabled={active}
                        key={rating}
                        onClick={() => {
                          onRate(review.id, rating, recall[review.id] ?? '');
                          setRecall(old => ({ ...old, [review.id]: '' }));
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="study-empty-reviews">
            Nenhum tópico vencido. Tópicos novos entram na fila para amanhã; depois, sua lembrança define o próximo
            intervalo.
          </p>
        )}
        {!!upcoming.length && (
          <details className="study-upcoming">
            <summary>Próximas revisões · {upcoming.length}</summary>
            {upcoming.map(review => {
              const task = available.get(review.taskId)!;
              return (
                <p key={review.id}>
                  {review.dueDate} · {task.skill || 'Sem matéria'} · {task.name}
                </p>
              );
            })}
          </details>
        )}
      </div>
      <small className="study-privacy-note">
        Seu progresso e suas lembranças ficam salvos neste navegador e entram no backup local.
      </small>
    </section>
  );
}
