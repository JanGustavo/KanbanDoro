export type WorkflowSettings = {
  profile: 'general' | 'study';
  goal: string;
  examDate?: string;
  dailyGoalMinutes?: number;
};
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
    label: 'Estudo',
    description: 'Organize matérias e tópicos, cumpra uma meta diária e revise o conteúdo no momento certo.',
    suggestedAreas: ['Direito Penal', 'Direito Administrativo', 'Direito Constitucional'],
  },
];
export function workflowContext(settings?: WorkflowSettings) {
  return {
    profile: settings?.profile === 'study' ? ('study' as const) : ('general' as const),
    goal: (settings?.goal ?? '').trim().slice(0, 500),
  };
}

export function normalizeWorkflowSettings(settings?: WorkflowSettings): WorkflowSettings {
  const context = workflowContext(settings);
  const goalMinutes = settings?.dailyGoalMinutes;
  const candidateDate = settings?.examDate ?? '';
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(candidateDate) ? Date.parse(`${candidateDate}T12:00:00Z`) : NaN;
  const examDate =
    Number.isFinite(parsedDate) && new Date(parsedDate).toISOString().slice(0, 10) === candidateDate
      ? candidateDate
      : '';
  return {
    ...context,
    examDate,
    dailyGoalMinutes:
      Number.isFinite(goalMinutes) && Number.isInteger(goalMinutes) ? Math.max(15, Math.min(720, goalMinutes!)) : 120,
  };
}
