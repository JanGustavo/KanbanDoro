export type WorkflowSettings = { profile: 'general' | 'study'; goal: string };
export type WorkflowProfile = {
  id: WorkflowSettings['profile'];
  label: string;
  description: string;
  suggestedAreas: readonly string[];
};
// Declarative profiles share the board, sessions, materials and backups. No remote code is executed.
export const workflowProfiles: readonly WorkflowProfile[] = [
  {
    id: 'general',
    label: 'Geral',
    description: 'Planejamento e foco para diferentes tipos de trabalho.',
    suggestedAreas: [],
  },
  {
    id: 'study',
    label: 'Estudo · base',
    description:
      'Contexto de estudo para propostas da IA. Currículos, questões e revisões espaçadas ficam para uma próxima etapa.',
    suggestedAreas: ['Direito Penal', 'Direito Administrativo', 'Direito Constitucional'],
  },
];
export function workflowContext(settings?: WorkflowSettings) {
  return {
    profile: settings?.profile === 'study' ? ('study' as const) : ('general' as const),
    goal: (settings?.goal ?? '').trim().slice(0, 500),
  };
}
