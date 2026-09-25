export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: AIModel;
  customEndpoint: string;
}

export type AIProvider = 'gemini' | 'groq' | 'openai' | 'custom' | '';
export type AIModel = string;

const DEFAULT_AI_SETTINGS: AISettings = {
  provider: '',
  apiKey: '',
  model: '',
  customEndpoint: '',
};

const STORAGE_KEY = 'kanbandoro_ai_settings';

export function getAISettings(): Promise<AISettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY).then((stored) => {
      const settings = stored[STORAGE_KEY] as AISettings | undefined;
      resolve({ ...DEFAULT_AI_SETTINGS, ...settings });
    });
  });
}

export function setAISettings(settings: Partial<AISettings>): Promise<void> {
  return getAISettings().then((current) => {
    const updated = { ...current, ...settings };
    return chrome.storage.local.set({ [STORAGE_KEY]: updated });
  });
}

export function clearAISettings(): Promise<void> {
  return chrome.storage.local.remove(STORAGE_KEY);
}

export const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    defaultModel: 'gemini-1.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  groq: {
    name: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1',
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    defaultModel: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1',
  },
  custom: {
    name: 'Custom (OpenAI-compatible)',
    models: [],
    defaultModel: '',
    endpoint: '',
  },
} as const;

export type ProviderKey = keyof typeof AI_PROVIDERS;