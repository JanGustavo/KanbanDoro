export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  model: string;
  customEndpoint: string;
  groqModel: string;
  geminiModel: string;
  openaiModel: string;
  groqSavedModels: string[];
  geminiSavedModels: string[];
  openaiSavedModels: string[];
}

export type AIProvider = 'xai' | 'gemini' | 'groq' | 'openai' | 'custom' | '';
const STORAGE_KEY = 'kanbandoro_ai_settings';
export const emptyAISettings: AISettings = {
  provider: '',
  apiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  model: '',
  customEndpoint: '',
  groqModel: '',
  geminiModel: '',
  openaiModel: '',
  groqSavedModels: [],
  geminiSavedModels: [],
  openaiSavedModels: [],
};

function remembered(models: unknown, selected: string): string[] {
  const list = Array.isArray(models) ? models.filter((item): item is string => typeof item === 'string' && !!item) : [];
  return [...new Set([...list, ...(selected ? [selected] : [])])].slice(-8);
}

export function normalizeAISettings(value: Partial<AISettings> = {}): AISettings {
  const provider = value.provider ?? '';
  const groqModel = value.groqModel ?? (provider === 'groq' ? (value.model ?? '') : '');
  const geminiModel = value.geminiModel ?? (provider === 'gemini' ? (value.model ?? '') : '');
  const openaiModel = value.openaiModel ?? (provider === 'openai' ? (value.model ?? '') : '');
  return {
    ...emptyAISettings,
    ...value,
    provider,
    groqModel,
    geminiModel,
    openaiModel,
    groqSavedModels: remembered(value.groqSavedModels, groqModel),
    geminiSavedModels: remembered(value.geminiSavedModels, geminiModel),
    openaiSavedModels: remembered(value.openaiSavedModels, openaiModel),
    model:
      provider === 'groq'
        ? groqModel
        : provider === 'gemini'
          ? geminiModel
          : provider === 'openai'
            ? openaiModel
            : (value.model ?? ''),
  };
}

export function selectAIProvider(settings: AISettings, provider: AIProvider): AISettings {
  return normalizeAISettings({
    ...settings,
    provider,
    model:
      provider === 'groq'
        ? settings.groqModel
        : provider === 'gemini'
          ? settings.geminiModel
          : provider === 'openai'
            ? settings.openaiModel
            : '',
  });
}

export function selectAIModel(settings: AISettings, model: string): AISettings {
  if (settings.provider === 'groq')
    return normalizeAISettings({
      ...settings,
      model,
      groqModel: model,
      groqSavedModels: remembered(settings.groqSavedModels, model),
    });
  if (settings.provider === 'gemini')
    return normalizeAISettings({
      ...settings,
      model,
      geminiModel: model,
      geminiSavedModels: remembered(settings.geminiSavedModels, model),
    });
  if (settings.provider === 'openai')
    return normalizeAISettings({
      ...settings,
      model,
      openaiModel: model,
      openaiSavedModels: remembered(settings.openaiSavedModels, model),
    });
  return { ...settings, model };
}

export function toggleAIModel(settings: AISettings, model: string): AISettings {
  if (settings.provider !== 'groq' && settings.provider !== 'gemini' && settings.provider !== 'openai') return settings;
  const groq = settings.provider === 'groq';
  const openai = settings.provider === 'openai';
  const list = groq ? settings.groqSavedModels : openai ? settings.openaiSavedModels : settings.geminiSavedModels;
  const enabled = list.includes(model);
  const next = enabled ? list.filter(item => item !== model) : remembered(list, model);
  const current = groq ? settings.groqModel : openai ? settings.openaiModel : settings.geminiModel;
  const selected = enabled && current === model ? (next[0] ?? '') : current || (!enabled ? model : '');
  return normalizeAISettings({
    ...settings,
    model: selected,
    ...(groq
      ? { groqModel: selected, groqSavedModels: next }
      : openai
        ? { openaiModel: selected, openaiSavedModels: next }
        : { geminiModel: selected, geminiSavedModels: next }),
  });
}

export function savedAIChoices(settings: AISettings): { provider: 'groq' | 'gemini' | 'openai'; model: string }[] {
  return (
    [
      ['groq', settings.apiKey, settings.groqSavedModels],
      ['gemini', settings.geminiApiKey, settings.geminiSavedModels],
      ['openai', settings.openaiApiKey, settings.openaiSavedModels],
    ] as const
  ).flatMap(([provider, key, models]) => (key ? models.map(model => ({ provider, model })) : []));
}

export function nextAIChoice(settings: AISettings): AISettings | null {
  const choices = savedAIChoices(settings);
  if (choices.length < 2) return null;
  const current = choices.findIndex(choice => choice.provider === settings.provider && choice.model === settings.model);
  const choice = choices[(current + 1) % choices.length];
  return selectAIModel(selectAIProvider(settings, choice.provider), choice.model);
}

export async function getAISettings(): Promise<AISettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeAISettings(stored[STORAGE_KEY] as Partial<AISettings> | undefined);
}

let pendingSave = Promise.resolve();
export function saveAISettings(settings: AISettings): Promise<void> {
  const snapshot = normalizeAISettings(settings);
  pendingSave = pendingSave.catch(() => {}).then(() => chrome.storage.local.set({ [STORAGE_KEY]: snapshot }));
  return pendingSave;
}

export function waitForAISettingsSave(): Promise<void> {
  return pendingSave;
}

export async function clearAISettings(): Promise<void> {
  await pendingSave.catch(() => {});
  await chrome.storage.local.remove(STORAGE_KEY);
}

// Provider IDs are stable; Groq's model catalogue is loaded from its API.
export const AI_PROVIDERS: Record<Exclude<AIProvider, ''>, string> = {
  xai: 'xAI (Grok)',
  gemini: 'Google Gemini',
  groq: 'Groq',
  openai: 'OpenAI',
  custom: 'Outro provedor',
};
