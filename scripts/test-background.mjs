import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const listeners = {};
const sent = [];
let injected = false;
let injections = 0;
let soundEnabled = true;
let session = { phase: 'running', endsAt: Date.now() + 60_000 };
let alerts = 0;
let notifications = 0;
let aiSettings = { provider: 'groq', apiKey: 'test-only', model: 'openai/gpt-oss-20b' };
const requests = [];
const chrome = {
  action: { onClicked: { addListener(fn) { listeners.click = fn; } }, setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  runtime: { getURL: path => path, sendMessage: async message => { if (message.type === 'PLAY_ALERT') alerts++; }, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { listeners.message = fn; } } },
  storage: { local: { setAccessLevel: async () => {}, get: async () => ({ session, soundEnabled, kanbandoro_ai_settings: aiSettings }) }, onChanged: { addListener() {} } },
  tabs: { query: async () => [{ id: 42 }], update: async () => {}, create: async () => {}, onActivated: { addListener() {} },
    async sendMessage(id, message) {
      assert.equal(id, 42);
      if (!injected) throw new Error('No receiving end');
      sent.push(message.type);
      return { ready: true };
    } },
  scripting: { async executeScript({ target, files }) {
    assert.equal(target.tabId, 42);
    assert.equal(files[0], 'content.js');
    injected = true;
    injections++;
  } },
  alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener(fn) { listeners.alarm = fn; } } },
  notifications: { create: async options => { assert.equal(options.silent, true); notifications++; } },
  offscreen: { hasDocument: async () => false, createDocument: async () => {} },
};
vm.runInNewContext(readFileSync('dist/background.js', 'utf8'), { chrome, AbortSignal, URL,
  fetch: async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [
      { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', active: true, input_modalities: ['text'], output_modalities: ['text'], supported_features: ['structured_outputs'] },
      { id: 'whisper', active: true, input_modalities: ['audio'], output_modalities: ['transcription'] },
    ] }) };
    if (url === 'https://example.org/info') return { ok: true, status: 200, url, headers: { get: () => null } };
    if (url === 'https://example.org/redirect') return { ok: false, status: 302, url, headers: { get: () => 'https://127.0.0.1/private' } };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ name: 'Criar API', description: 'Implementar rotas', difficulty: 2, estimate: 35, slices: ['Rotas', 'Testes'], attachments: [{ title: 'Documentação', url: 'https://example.org/info' }, { title: 'Interno', url: 'http://localhost/private' }] }) } }] }) };
  } });
const aiMessage = (message, senderUrl = 'index.html') => new Promise(resolve => {
  const accepted = listeners.message(message, { url: senderUrl }, resolve);
  if (!accepted) resolve(null);
});
assert.equal(await aiMessage({ type: 'GROQ_MODELS' }, 'https://example.com'), null, 'content scripts must not call the AI API');
assert.equal(requests.length, 0);
const catalog = await aiMessage({ type: 'GROQ_MODELS' });
assert.equal(catalog.models.length, 1, 'only eligible text models should be offered');
const draft = await aiMessage({ type: 'GROQ_TASK_PROPOSAL', input: 'Criar API' });
assert.equal(draft.proposal.estimate, 35);
assert.equal(draft.proposal.attachments[0].verifiedAt > 0, true);
assert.equal(draft.proposal.attachments[1].verifiedAt, null);
const redirect = await aiMessage({ type: 'CHECK_ATTACHMENT', url: 'https://example.org/redirect' });
assert.equal(redirect.check.verifiedAt, null, 'redirects into local addresses must not be followed');
assert(!requests.some(req => req.url.includes('127.0.0.1') || req.url.includes('localhost')));
assert.equal(requests[1].options.headers.Authorization, 'Bearer test-only');
assert.equal(requests[1].options.body.includes('test-only'), false, 'keys must not enter the prompt');
listeners.message({ type: 'SHOW_TIMER' }, {}, () => {});
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(injections, 1);
assert(sent.includes('SHOW_TIMER'));
listeners.message({ type: 'SHOW_TIMER' }, {}, () => {});
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(injections, 1, 'an existing content script must not be injected twice');
session = { phase: 'running', endsAt: Date.now() - 1000 };
await listeners.alarm({ name: 'timer-end' });
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(alerts, 1);
soundEnabled = false;
session = { phase: 'break', endsAt: Date.now() - 1000 };
await listeners.alarm({ name: 'timer-end' });
assert.equal(alerts, 1, 'muting must disable sound');
assert.equal(notifications, 2, 'system notifications stay available when muted');
session = null;
await listeners.alarm({ name: 'timer-end' });
assert.equal(notifications, 2, 'stale alarms must be ignored');
console.log('Bolha instalada em aba antiga e reutilizada na próxima abertura.');
