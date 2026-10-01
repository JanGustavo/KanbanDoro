/** A manual name is the user's request, not a title the AI must copy verbatim. */
export function proposalContext<T extends { name: string; estimate: number; difficulty: number }>(
  draft: T,
  source: 'manual' | 'ai',
  edited: { estimate: boolean; difficulty: boolean },
): Omit<T, 'name' | 'estimate' | 'difficulty'> & Partial<Pick<T, 'name' | 'estimate' | 'difficulty'>> {
  const { name, estimate, difficulty, ...context } = draft;
  return {
    ...context,
    ...(source === 'ai' ? { name } : {}),
    ...(source === 'ai' || edited.estimate ? { estimate } : {}),
    ...(source === 'ai' || edited.difficulty ? { difficulty } : {}),
  };
}

/** Keep the complete request separate from the fields to preserve. */
export function proposalInput(draft: { name: string; description: string }): string {
  return [draft.name, draft.description].filter(Boolean).join('\n').trim();
}
