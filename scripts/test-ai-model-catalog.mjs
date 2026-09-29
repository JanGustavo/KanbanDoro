import assert from 'node:assert/strict';
import { verifiedAIModels } from '../src/aiModelCatalog.ts';

const groq = verifiedAIModels('groq', [
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B' }, // Older service worker, no freeTier flag.
  { id: 'future/new-model', name: 'Future Model', freeTier: true }, // Never trust an unverified flag.
]);
assert.equal(groq.length, 2);
assert.equal(groq[0].freeTier, true);
assert.equal(groq[1].freeTier, false);
const gemini = verifiedAIModels('gemini', [
  { id: 'gemini-2.5-flash', name: 'Gemini Flash' },
  { id: 'gemini-3.8-flash', name: 'Gemini Flash 3.8' },
  { id: 'gemini-3.1-flash-image', name: 'Image' },
  { id: 'gemini-3.8-flash-tts', name: 'Speech' },
]);
assert.deepEqual(
  gemini.map(model => model.id),
  ['gemini-2.5-flash', 'gemini-3.8-flash'],
);
assert.equal(gemini[0].freeTier, true);
assert.equal(gemini[1].freeTier, true);
console.log('Catálogo de IA: modelos livres comprovados e modelos incompatíveis verificados.');
