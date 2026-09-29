export type ListedAIModel = { id: string; name: string; freeTier?: boolean };

// Older extension service workers may still return a catalog without freeTier.
// Only exact IDs verified in the providers' public free-tier tables are tagged.
const FREE_GROQ = new Set(['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']);
const FREE_GEMINI = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);

export function verifiedAIModels(provider: string, catalog: unknown): ListedAIModel[] {
  if (!Array.isArray(catalog)) return [];
  const verified = provider === 'groq' ? FREE_GROQ : provider === 'gemini' ? FREE_GEMINI : new Set<string>();
  return catalog
    .filter(
      (model): model is ListedAIModel => typeof model?.id === 'string' && !!model.id && typeof model.name === 'string',
    )
    .filter(model => provider !== 'gemini' || !/(?:image|tts|audio|live)/i.test(model.id))
    .map(model => ({ id: model.id, name: model.name, freeTier: verified.has(model.id) }));
}
