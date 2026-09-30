export type BubblePreferences = { mode: 'open' | 'compact' | 'hidden'; position: 'left' | 'right' };
export const defaultBubblePreferences: BubblePreferences = { mode: 'open', position: 'right' };
export function normalizeBubblePreferences(value: unknown): BubblePreferences {
  const raw = value && typeof value === 'object' ? (value as Partial<BubblePreferences>) : {};
  return {
    mode: raw.mode === 'compact' || raw.mode === 'hidden' ? raw.mode : 'open',
    position: raw.position === 'left' ? 'left' : 'right',
  };
}
