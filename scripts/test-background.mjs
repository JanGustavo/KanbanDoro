import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const listeners = {};
const sent = [];
let injected = false;
let injections = 0;
let soundEnabled = true;
let session = { phase: 'running', endsAt: Date.now() + 60_000 };
let alerts = 0;
let notifications = 0;
let aiSettings = { provider: 'groq', apiKey: 'test-only', model: 'openai/gpt-oss-20b' };
let googleSession = '';
let launched = 0;
let authorizedScopes = ['https://www.googleapis.com/auth/gmail.readonly'];
const requests = [];
const chrome = {
  action: { onClicked: { addListener(fn) { listeners.click = fn; } }, setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  runtime: { getURL: path => path, sendMessage: async message => { if (message.type === 'PLAY_ALERT') alerts++; }, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { listeners.message = fn; } } },
  identity: { getRedirectURL: () => 'https://extension.chromiumapp.org/', launchWebAuthFlow: async ({ url, interactive }) => { launched++; assert(interactive); const query = new URL(url).searchParams; assert.equal(query.get('code_challenge_method'), 'S256'); return `https://extension.chromiumapp.org/?code=code-test&state=${query.get('state')}`; } },
  storage: { local: { setAccessLevel: async () => {}, get: async () => ({ session, soundEnabled, kanbandoro_ai_settings: aiSettings, google_connection_session: googleSession }), set: async item => { googleSession = item.google_connection_session; }, remove: async () => { googleSession = ''; } }, onChanged: { addListener() {} } },
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
vm.runInNewContext(readFileSync('dist/background.js', 'utf8'), { chrome, AbortSignal, URL, crypto: webcrypto, TextEncoder, btoa,
  fetch: async (url, options) => {
    requests.push({ url, options });
    if (url === 'connections-config.json') return { json: async () => ({ clientId: 'test.apps.googleusercontent.com', apiUrl: 'http://localhost:8000' }) };
    if (url.startsWith('http://localhost:8000/connections/google')) {
      if (url.endsWith('/exchange')) { const body = JSON.parse(options.body); assert.equal(body.code, 'code-test'); assert.equal(body.redirect_uri, 'https://extension.chromiumapp.org/'); assert.equal(body.code_verifier.length, 43); return { ok: true, json: async () => ({ session: 'private-server-session' }) }; }
      if (url.endsWith('/status')) return { ok: true, json: async () => ({ connected: true, scopes: authorizedScopes }) };
      if (options.method === 'DELETE') return { ok: true, json: async () => ({ connected: false }) };
      assert.equal(options.headers.Authorization, 'Bearer private-server-session');
      if (url.includes('/gmail/messages')) return { ok: true, json: async () => ({ messages: [{ id: 'msg-1', subject: 'Assunto' }] }) };
      if (url.includes('/calendar/events')) return { ok: true, json: async () => ({ events: [{ id: 'event-1', title: 'Evento' }] }) };
      if (url.includes('/tasks/lists/')) return { ok: true, json: async () => ({ tasks: [{ id: 'task-1', title: 'Tarefa' }] }) };
      if (url.endsWith('/tasks/lists')) return { ok: true, json: async () => ({ lists: [{ id: 'list-1', title: 'Lista' }] }) };
      if (options.method === 'POST') {
        assert.equal(options.headers.Authorization, 'Bearer private-server-session');
        return { ok: true, json: async () => ({ id: 'created-item' }) };
      }
    }
    if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [
      { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', active: true, input_modalities: ['text'], output_modalities: ['text'], supported_features: ['structured_outputs'] },
      { id: 'whisper', active: true, input_modalities: ['audio'], output_modalities: ['transcription'] },
    ] }) };
    if (url === 'https://example.org/info') return { ok: true, status: 200, url, headers: { get: () => null } };
    if (url === 'https://example.org/redirect') return { ok: false, status: 302, url, headers: { get: () => 'https://127.0.0.1/private' } };
    const connectionDraft = options?.body?.includes('connection_draft');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(connectionDraft ?
      { title: 'Estudar', description: 'Linux', start: '', end: '', to: '', subject: '', body: '' } :
      { name: 'Criar API', description: 'Implementar rotas', difficulty: 2, estimate: 35, slices: ['Rotas', 'Testes'], attachments: [{ title: 'Documentação', url: 'https://example.org/info' }, { title: 'Interno', url: 'http://localhost/private' }] }) } }] }) };
  } });
const aiMessage = (message, senderUrl = 'index.html') => new Promise(resolve => {
  const accepted = listeners.message(message, { url: senderUrl }, resolve);
  if (!accepted) resolve(null);
});
assert.equal(await aiMessage({ type: 'GROQ_MODELS' }, 'https://example.com'), null, 'content scripts must not call the AI API');
assert.equal(await aiMessage({ type: 'GMAIL_CONNECT' }, 'https://example.com'), null, 'content scripts must not access Gmail');
assert.equal(launched, 0);
assert.equal((await aiMessage({ type: 'GMAIL_STATUS' })).connected, false);
assert.equal((await aiMessage({ type: 'GMAIL_CONNECT' })).connected, true);
assert.equal(launched, 1);
assert.equal((await aiMessage({ type: 'GOOGLE_STATUS' })).needsReconnect, true, 'old sessions require new scopes');
authorizedScopes = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/tasks'];
assert.equal((await aiMessage({ type: 'GOOGLE_STATUS' })).needsReconnect, false);
const inbox = await aiMessage({ type: 'GMAIL_SEARCH', query: 'newer_than:7d' });
assert.equal(inbox.messages[0].subject, 'Assunto');
assert.equal((await aiMessage({ type: 'CALENDAR_EVENTS', start: '2026-09-26T00:00:00Z', end: '2026-09-27T00:00:00Z' })).events[0].title, 'Evento');
assert.equal((await aiMessage({ type: 'TASKS_LISTS' })).lists[0].title, 'Lista');
assert.equal((await aiMessage({ type: 'TASKS_ITEMS', listId: 'list-1' })).tasks[0].title, 'Tarefa');
assert.equal(JSON.stringify(inbox).includes('private-server-session'), false, 'session must stay in the service worker');
assert.equal((await aiMessage({ type: 'GMAIL_DISCONNECT' })).connected, false);
assert.equal((await aiMessage({ type: 'GMAIL_SEARCH' })).error.includes('Conecte'), true);
requests.length = 0;
assert.equal(requests.length, 0);
const catalog = await aiMessage({ type: 'GROQ_MODELS' });
assert.equal(catalog.models.length, 1, 'only eligible text models should be offered');
const draft = await aiMessage({ type: 'GROQ_TASK_PROPOSAL', input: 'Criar API' });
assert.equal(draft.proposal.estimate, 35);
assert.equal(draft.proposal.attachments[0].verifiedAt > 0, true);
assert.equal(draft.proposal.attachments[1].verifiedAt, null);
const redirect = await aiMessage({ type: 'CHECK_ATTACHMENT', url: 'https://example.org/redirect' });
assert.equal(redirect.check.verifiedAt, null, 'redirects into local addresses must not be followed');
assert(!requests.some(req => req.url.includes('127.0.0.1/private')));
assert.equal(requests[1].options.headers.Authorization, 'Bearer test-only');
assert.equal(requests[1].options.body.includes('test-only'), false, 'keys must not enter the prompt');
assert.equal((await aiMessage({ type: 'GROQ_CONNECTION_PROPOSAL', kind: 'tasks', prompt: 'Estudar Linux', now: '2026-09-26T12:00:00Z', timeZone: 'America/Sao_Paulo' })).draft.title, 'Estudar');
assert(!requests.some(request => request.options?.method === 'POST' && request.url.includes('localhost:8000')), 'an AI draft must not write to Google');
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
