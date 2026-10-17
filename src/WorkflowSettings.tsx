import { normalizeWorkflowSettings, workflowProfiles, type WorkflowSettings as Settings } from './workflowProfiles';
export default function WorkflowSettings({
  value,
  onChange,
  onAddArea,
}: {
  value: Settings;
  onChange: (value: Settings) => void;
  onAddArea: (area: string) => void;
}) {
  const profile = workflowProfiles.find(profile => profile.id === value.profile) ?? workflowProfiles[0];
  return (
    <fieldset className="workflow-settings">
      <legend>Perfil de uso</legend>
      <label>
        Contexto do aplicativo
        <select
          value={profile.id}
          onChange={event =>
            onChange(normalizeWorkflowSettings({ ...value, profile: event.target.value as Settings['profile'] }))
          }
        >
          {workflowProfiles.map(profile => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>
      <p>{profile.description}</p>
      <label>
        {profile.id === 'study' ? 'Objetivo de estudo' : 'Objetivo do perfil (opcional)'}
        <input
          maxLength={500}
          value={value.goal}
          placeholder="Ex.: concurso para técnico judiciário"
          onChange={event => onChange({ ...value, goal: event.target.value })}
        />
      </label>
      {profile.id === 'study' && (
        <div className="study-preferences">
          <label>
            Meta diária de estudo (minutos)
            <input
              type="number"
              min={15}
              max={720}
              step={15}
              value={value.dailyGoalMinutes ?? 120}
              onChange={event => {
                const raw = Number(event.target.value);
                onChange({
                  ...value,
                  dailyGoalMinutes: Number.isFinite(raw) ? Math.max(15, Math.min(720, Math.round(raw / 15) * 15)) : 120,
                });
              }}
            />
          </label>
          <label>
            Data da prova (opcional)
            <input
              type="date"
              value={value.examDate ?? ''}
              onChange={event => onChange({ ...value, examDate: event.target.value })}
            />
          </label>
        </div>
      )}
      <small>
        Matéria fica na área da tarefa; cada tarefa representa um tópico e suas etapas dividem o conteúdo. Objetivo e
        perfil dão contexto às propostas de IA. Sua meta e a data da prova ficam neste navegador.
      </small>
      {!!profile.suggestedAreas.length && (
        <div className="workflow-areas">
          <p>Áreas sugeridas; adicione apenas as que usar:</p>
          {profile.suggestedAreas.map(area => (
            <button type="button" key={area} onClick={() => onAddArea(area)}>
              + {area}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
