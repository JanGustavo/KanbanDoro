import { calculateStats } from './stats';

type Props = {
  tasks: Array<{ id: string; skill?: string; estimate: number; focusSeconds: number; failures: number; column: string; completedAt?: number }>;
  history: Array<{ taskId: string; seconds: number; at: number; kind: string }>;
  now: number;
  onClose: () => void;
};

const duration = (seconds: number) => `${Math.round(seconds / 60)} min`;

export default function Statistics({ tasks, history, now, onClose }: Props) {
  const stats = calculateStats(tasks, history, now);
  const max = Math.max(1, ...stats.daily.map(day => day.seconds));
  return <section className="stats-panel" aria-label="Estatísticas de trabalho">
    <header className="stats-heading"><div><span className="eyebrow">SEU RITMO</span><h2>Habilidades e tempo</h2><p>Dados das tarefas e ciclos registrados neste navegador.</p></div><button onClick={onClose}>Voltar ao quadro</button></header>
    <div className="stats-summary">
      <article><span>Foco registrado</span><strong>{duration(stats.totalFocusSeconds)}</strong><small>Inclui tarefas arquivadas</small></article>
      <article><span>Concluídas</span><strong>{stats.totalCompleted}</strong><small>Em todas as áreas</small></article>
      <article><span>Dentro da estimativa</span><strong>{stats.measured ? `${stats.withinEstimate}/${stats.measured}` : '—'}</strong><small>Concluídas com tempo medido</small></article>
      <article><span>Tentativas falhas</span><strong>{stats.totalFailures}</strong><small>Registradas nos ciclos</small></article>
    </div>
    <div className="stats-layout"><div className="stats-section"><h3>Áreas de trabalho</h3><p className="stats-note">Você escolhe a área em cada tarefa. O tempo e os resultados são calculados dos registros.</p>
      {stats.areas.length === 0 ? <p className="stats-empty">Crie uma tarefa e registre um ciclo para começar.</p> : stats.areas.map(area => <article className="stats-area" key={area.name}>
        <div className="stats-area-title"><strong>{area.name}</strong><span>{duration(area.focusSeconds)}</span></div>
        <div className="stats-area-bar"><span style={{ width: `${stats.totalFocusSeconds ? Math.max(2, area.focusSeconds / stats.totalFocusSeconds * 100) : 0}%` }} /></div>
        <p>{area.completed}/{area.tasks} concluídas · {area.failures} tentativas falhas</p>
        <small>{area.measured ? `${area.withinEstimate}/${area.measured} dentro da estimativa · ${Math.round(area.actualMinutes)} min reais / ${Math.round(area.estimatedMinutes)} min previstos` : 'Sem conclusões com estimativa e tempo medido'}{area.measured > 0 && area.measured < 3 ? ' · amostra pequena' : ''}</small>
      </article>)}
    </div><div className="stats-section"><h3>Foco nesta semana</h3><p className="stats-note">Minutos dos ciclos registrados, de segunda a domingo.</p>
      <div className="stats-chart" role="img" aria-label={stats.daily.map(day => `${day.day}: ${duration(day.seconds)}`).join('; ')}>{stats.daily.map(day => <div className="stats-day" key={day.day}><span className="stats-value">{Math.round(day.seconds / 60)}</span><div className="stats-column"><span style={{ height: `${day.seconds ? Math.max(5, day.seconds / max * 100) : 0}%` }} /></div><small>{new Date(`${day.day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small></div>)}</div>
      <p className="stats-note">Estimativas medem planejamento, não determinam sua capacidade. Tarefas sem área aparecem em “Sem categoria”.</p>
    </div></div>
  </section>;
}
