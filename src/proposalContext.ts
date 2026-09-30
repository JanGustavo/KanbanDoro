/** Manual defaults are editing conveniences, not user constraints for the AI. */
export function proposalContext<T extends { estimate: number; difficulty: number }>(
  draft: T,
  source: 'manual' | 'ai',
  edited: { estimate: boolean; difficulty: boolean },
): Omit<T, 'estimate' | 'difficulty'> & Partial<Pick<T, 'estimate' | 'difficulty'>> {
  const { estimate, difficulty, ...context } = draft;
  return {
    ...context,
    ...(source === 'ai' || edited.estimate ? { estimate } : {}),
    ...(source === 'ai' || edited.difficulty ? { difficulty } : {}),
  };
}
