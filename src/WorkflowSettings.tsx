import { workflowProfiles, type WorkflowSettings as Settings } from './workflowProfiles';
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
          onChange={event => onChange({ ...value, profile: event.target.value as Settings['profile'] })}
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
        Objetivo (opcional)
        <input
          maxLength={500}
          value={value.goal}
          placeholder="Ex.: concurso para técnico judiciário"
          onChange={event => onChange({ ...value, goal: event.target.value })}
        />
      </label>
      <small>
        Perfil e objetivo acompanham os pedidos de proposta de tarefa e análise de etapas enviados à IA. Nada é enviado
        ao trocar o perfil; suas tarefas e áreas são preservadas.
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
