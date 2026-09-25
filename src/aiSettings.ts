export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
}

export type AIProvider = 'xai' | 'gemini' | 'groq' | 'openai' | 'custom' | '';
const STORAGE_KEY = 'kanbandoro_ai_settings';
const empty: AISettings = { provider: '', apiKey: '', model: '', customEndpoint: '' };

export async function getAISettings(): Promise<AISettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...empty, ...(stored[STORAGE_KEY] as Partial<AISettings> | undefined) };
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

export async function clearAISettings(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

// Provider IDs are stable; model names are entered by the user because catalogues change.
export const AI_PROVIDERS: Record<Exclude<AIProvider, ''>, string> = {
  xai: 'xAI (Grok)',
  gemini: 'Google Gemini',
  groq: 'Groq (outro serviço)',
  openai: 'OpenAI',
  custom: 'Outro provedor',
};
