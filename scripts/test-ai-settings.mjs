import assert from 'node:assert/strict';
import {
  emptyAISettings,
  getAISettings,
  saveAISettings,
  selectAIProvider,
  selectAIModel,
  toggleAIModel,
  nextAIChoice,
  savedAIChoices,
} from '../src/aiSettings.ts';

const data = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        return { [key]: data[key] };
      },
      async set(values) {
        Object.assign(data, values);
      },
      async remove(key) {
        delete data[key];
      },
    },
  },
};

data.kanbandoro_ai_settings = {
  provider: 'groq',
  apiKey: 'groq-test-key',
  geminiApiKey: 'gemini-test-key',
  model: 'openai/gpt-oss-20b',
};
let settings = await getAISettings();
assert.equal(settings.groqModel, 'openai/gpt-oss-20b');
assert.deepEqual(settings.groqSavedModels, ['openai/gpt-oss-20b']);
settings = selectAIModel(settings, 'openai/gpt-oss-120b');
settings = selectAIProvider(settings, 'gemini');
assert.equal(settings.model, '');
settings = selectAIModel(settings, 'gemini-2.5-flash');
await saveAISettings(settings);
settings = await getAISettings();
assert.equal(settings.apiKey, 'groq-test-key');
assert.equal(settings.geminiApiKey, 'gemini-test-key');
assert.equal(settings.groqModel, 'openai/gpt-oss-120b');
assert.equal(settings.geminiModel, 'gemini-2.5-flash');
assert.deepEqual(
  savedAIChoices(settings).map(choice => choice.model),
  ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'gemini-2.5-flash'],
);
settings = nextAIChoice(settings);
assert.equal(settings.provider, 'groq');
assert.equal(settings.model, 'openai/gpt-oss-20b');
settings = toggleAIModel(settings, 'openai/gpt-oss-20b');
assert.equal(settings.model, 'openai/gpt-oss-120b');
assert.deepEqual(
  savedAIChoices(settings).map(choice => choice.model),
  ['openai/gpt-oss-120b', 'gemini-2.5-flash'],
);
settings = toggleAIModel(settings, 'openai/gpt-oss-120b');
assert.equal(settings.model, '');
assert.deepEqual(settings.groqSavedModels, []);
settings = toggleAIModel(settings, 'openai/gpt-oss-20b');
assert.equal(settings.model, 'openai/gpt-oss-20b');
await saveAISettings(settings);
assert.equal((await getAISettings()).geminiModel, 'gemini-2.5-flash');
settings = { ...settings, geminiApiKey: '' };
assert.deepEqual(
  savedAIChoices(settings).map(choice => choice.model),
  ['openai/gpt-oss-20b'],
);
assert.equal(nextAIChoice(emptyAISettings), null);
console.log('Configurações de IA: chaves isoladas, migração e alternância verificadas.');
