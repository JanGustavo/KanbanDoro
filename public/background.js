async function openBoard() {
  const url = chrome.runtime.getURL('index.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs[0]?.id) return chrome.tabs.update(tabs[0].id, { active: true });
  return chrome.tabs.create({ url });
}
chrome.action.onClicked.addListener(openBoard);

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Tocar um aviso sonoro curto ao fim de um ciclo de foco ou pausa.'
  });
}
async function playAlert(variant) {
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: 'PLAY_ALERT', variant });
  } catch {
    // Offscreen indisponível neste navegador: a notificação do sistema segue como aviso.
  }
}

// Content scripts display the floating timer and must not access saved API keys.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (['GROQ_MODELS', 'GROQ_TASK_PROPOSAL', 'CHECK_ATTACHMENT', 'GOOGLE_STATUS', 'GOOGLE_CONNECT', 'GOOGLE_DISCONNECT', 'GMAIL_STATUS', 'GMAIL_CONNECT', 'GMAIL_SEARCH', 'GMAIL_DISCONNECT', 'CALENDAR_EVENTS', 'TASKS_LISTS', 'TASKS_ITEMS'].includes(message?.type)) {
    if (_sender.url !== chrome.runtime.getURL('index.html')) return;
    (['GMAIL_', 'GOOGLE_', 'CALENDAR_', 'TASKS_'].some(prefix => message.type.startsWith(prefix)) ? handleGoogle(message) : handleGroq(message))
      .then(sendResponse).catch(error => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === 'GET_TIMER') {
    chrome.storage.local.get('session').then(({ session }) => sendResponse({ session: session || null }));
    return true;
  }
  if (message?.type === 'OPEN_BOARD') {
    openBoard();
  }
  if (message?.type === 'SHOW_TIMER') {
    showTimerInActiveTab();
  }
});

const GROQ_URL = 'https://api.groq.com/openai/v1';
const GOOGLE_SESSION = 'google_connection_session';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/tasks.readonly'
];
let connectionConfig;
async function getConnectionConfig() {
  if (!connectionConfig) connectionConfig = fetch(chrome.runtime.getURL('connections-config.json')).then(response => response.json());
  return connectionConfig;
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function connectionRequest(path, session, options = {}) {
  const { apiUrl } = await getConnectionConfig();
  const response = await fetch(apiUrl + '/connections/google' + path, {
    ...options, headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) },
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.local.remove(GOOGLE_SESSION);
      throw Error('Conexão expirada. Conecte sua conta Google novamente.');
    }
    const detail = await response.json().catch(() => ({}));
    throw Error(typeof detail.detail === 'string' ? detail.detail : `Servidor indisponível (${response.status}).`);
  }
  return response.json();
}
async function connectGoogle() {
  const { clientId } = await getConnectionConfig();
  const redirectUri = chrome.identity.getRedirectURL();
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  Object.entries({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '), access_type: 'offline', prompt: 'consent',
    code_challenge: challenge, code_challenge_method: 'S256', state }).forEach(([key, value]) => url.searchParams.set(key, value));
  const finalUrl = await chrome.identity.launchWebAuthFlow({ url: url.href, interactive: true });
  if (!finalUrl || !finalUrl.startsWith(redirectUri + '?')) throw Error('Redirecionamento OAuth inesperado.');
  const params = new URL(finalUrl).searchParams;
  if (params.get('state') !== state) throw Error('Estado OAuth inválido. Tente novamente.');
  if (params.has('error')) throw Error('Autorização Google cancelada ou recusada.');
  const code = params.get('code');
  if (!code) throw Error('Google não retornou o código de autorização.');
  const result = await connectionRequest('/exchange', null, {
    method: 'POST', body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: redirectUri })
  });
  await chrome.storage.local.set({ [GOOGLE_SESSION]: result.session });
  return { configured: true, connected: true };
}
async function handleGoogle(message) {
  const { clientId, apiUrl } = await getConnectionConfig();
  const configured = Boolean(clientId && apiUrl);
  if (message.type === 'GOOGLE_STATUS' || message.type === 'GMAIL_STATUS') {
    const saved = await chrome.storage.local.get(GOOGLE_SESSION);
    if (!configured || !saved[GOOGLE_SESSION]) return { configured, connected: false };
    try { await connectionRequest('/status', saved[GOOGLE_SESSION]); return { configured, connected: true }; }
    catch { return { configured, connected: false }; }
  }
  if (!configured) throw Error('Configure o cliente OAuth Web e a URL do backend para Connections.');
  if (message.type === 'GOOGLE_CONNECT' || message.type === 'GMAIL_CONNECT') return connectGoogle();
  const saved = await chrome.storage.local.get(GOOGLE_SESSION);
  const session = saved[GOOGLE_SESSION];
  if (message.type === 'GOOGLE_DISCONNECT' || message.type === 'GMAIL_DISCONNECT') {
    if (session) await connectionRequest('', session, { method: 'DELETE' });
    await chrome.storage.local.remove(GOOGLE_SESSION);
    return { configured, connected: false };
  }
  if (!session) throw Error('Conecte sua conta Google antes de consultar os dados.');
  if (message.type === 'GMAIL_SEARCH') return connectionRequest(`/gmail/messages?q=${encodeURIComponent(String(message.query || '').slice(0, 200))}`, session);
  if (message.type === 'CALENDAR_EVENTS') return connectionRequest(`/calendar/events?start=${encodeURIComponent(message.start)}&end=${encodeURIComponent(message.end)}`, session);
  if (message.type === 'TASKS_LISTS') return connectionRequest('/tasks/lists', session);
  if (message.type === 'TASKS_ITEMS') return connectionRequest(`/tasks/lists/${encodeURIComponent(String(message.listId || ''))}`, session);
  throw Error('Operação desconhecida.');
}
function safeAttachmentUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.')
      || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')
      || /^\d+(\.\d+){3}$/.test(host) || host.includes(':')) return null;
    return url.href;
  } catch { return null; }
}
async function checkAttachment(value) {
  const url = safeAttachmentUrl(value);
  if (!url) return { url: String(value || '').slice(0, 1000), verifiedAt: null, reason: 'Use um link público HTTPS válido.' };
  try {
    let { response, finalUrl } = await fetchPublicPage(url, 'HEAD');
    if ([403, 405, 501].includes(response.status)) ({ response, finalUrl } = await fetchPublicPage(url, 'GET'));
    if (response.ok && finalUrl) return { url: finalUrl, verifiedAt: Date.now(), reason: '' };
    return { url, verifiedAt: null, reason: `Não foi possível confirmar o endereço (${response.status}).` };
  } catch {
    return { url, verifiedAt: null, reason: 'O site não permitiu confirmar o link agora.' };
  }
}
async function fetchPublicPage(start, method) {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(url, { method, signal: AbortSignal.timeout(7000), redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw Error('Redirecionamento sem destino');
      url = safeAttachmentUrl(new URL(location, url).href);
      if (!url) throw Error('Redirecionamento inválido');
      continue;
    }
    return { response, finalUrl: safeAttachmentUrl(response.url) };
  }
  throw Error('Redirecionamentos em excesso');
}
async function groqRequest(path, apiKey, body) {
  const response = await fetch(GROQ_URL + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) {
    if (response.status === 401) throw Error('Chave da Groq inválida. Revise a configuração.');
    if (response.status === 429) throw Error('Limite da Groq atingido. Tente novamente mais tarde.');
    throw Error(`Groq não respondeu à solicitação (${response.status}).`);
  }
  return response.json();
}
async function handleGroq(message) {
  if (message.type === 'CHECK_ATTACHMENT') return { check: await checkAttachment(message.url) };
  const stored = await chrome.storage.local.get('kanbandoro_ai_settings');
  const settings = stored.kanbandoro_ai_settings;
  if (settings?.provider !== 'groq' || !settings.apiKey) throw Error('Salve sua chave da Groq em Preferências → IA.');
  if (message.type === 'GROQ_MODELS') {
    const result = await groqRequest('/models', settings.apiKey);
    const models = (result.data || []).filter(model => model.active && model.input_modalities?.includes('text') && model.output_modalities?.includes('text')
      && model.supported_features?.includes('structured_outputs') && !model.id.includes('safeguard'));
    return { models: models.map(model => ({ id: model.id, name: model.name || model.id })) };
  }
  const input = String(message.input || '').trim().slice(0, 2500);
  if (!input || !settings.model) throw Error('Informe a tarefa e escolha um modelo da Groq.');
  const previous = message.previous && typeof message.previous === 'object' ? JSON.stringify(message.previous).slice(0, 3000) : '';
  const feedback = String(message.feedback || '').trim().slice(0, 1000);
  const result = await groqRequest('/chat/completions', settings.apiKey, {
    model: settings.model,
    messages: [
      { role: 'system', content: 'Você organiza tarefas para um Kanban Pomodoro. Responda em português brasileiro. Sugira tempo total em minutos e dificuldade 1 leve, 2 média, 3 alta. Slices são etapas curtas e concretas. Sugira até 3 links HTTPS específicos e relevantes como anexos apenas se conhecer os endereços reais; nunca invente URLs, paths de busca ou vagas. Se não tiver certeza, devolva anexos vazios. Nunca execute ações nem considere que a proposta foi aceita.' },
      { role: 'user', content: JSON.stringify({ pedido: input, proposta_anterior: previous, comentario: feedback }) }
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'task_proposal', strict: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'].includes(settings.model), schema: {
      type: 'object', additionalProperties: false, required: ['name', 'description', 'difficulty', 'estimate', 'slices', 'attachments'],
      properties: { name: { type: 'string' }, description: { type: 'string' }, difficulty: { type: 'integer' }, estimate: { type: 'integer' }, slices: { type: 'array', items: { type: 'string' } }, attachments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'url'], properties: { title: { type: 'string' }, url: { type: 'string' } } } } }
    } } },
    max_completion_tokens: 1200
  });
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw Error('O modelo não retornou uma proposta. Tente novamente.');
  let draft;
  try { draft = JSON.parse(text); } catch { throw Error('O modelo retornou uma proposta incompleta. Tente novamente.'); }
  if (typeof draft.name !== 'string' || !draft.name.trim() || typeof draft.description !== 'string' || !Number.isInteger(draft.estimate) || draft.estimate < 1 || draft.estimate > 480 || ![1, 2, 3].includes(draft.difficulty)
    || !Array.isArray(draft.slices) || draft.slices.some(s => typeof s !== 'string') || !Array.isArray(draft.attachments)) throw Error('A proposta precisa de revisão. Tente novamente.');
  const attachments = await Promise.all(draft.attachments.slice(0, 3).filter(a => typeof a?.title === 'string' && typeof a?.url === 'string')
    .map(async a => ({ title: a.title.trim().slice(0, 120), ...await checkAttachment(a.url) })));
  return { proposal: { name: draft.name.trim().slice(0, 140), description: draft.description.slice(0, 3000), difficulty: draft.difficulty, estimate: draft.estimate, slices: draft.slices.filter(s => s.trim()).slice(0, 8).map(s => s.trim().slice(0, 140)), attachments } };
}

async function ensureTimerInTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING_TIMER' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      return true;
    } catch {
      // Browser-internal and other restricted pages do not allow injection.
      return false;
    }
  }
}

async function showTimerInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && await ensureTimerInTab(tab.id)) {
    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TIMER' }).catch(() => {});
  }
}

async function broadcastTimer(session) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.filter(tab => tab.id).map(tab =>
    chrome.tabs.sendMessage(tab.id, { type: 'TIMER_CHANGED', session }).catch(() => {})
  ));
  // An existing tab can predate installation or reload of the extension.
  const activeTabs = await chrome.tabs.query({ active: true });
  await Promise.all(activeTabs.filter(tab => tab.id).map(tab => ensureTimerInTab(tab.id)));
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { session } = await chrome.storage.local.get('session');
  if (session && (session.phase === 'running' || session.phase === 'break')) {
    await ensureTimerInTab(tabId);
  }
});

const COLOR_FOCUS = '#8f2948';
const COLOR_BREAK = '#c98a1c';
const COLOR_DUE = '#d94f4f';

async function reconcile() {
  const { session } = await chrome.storage.local.get('session');
  if (!session || (session.phase !== 'running' && session.phase !== 'break')) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const remaining = session.endsAt - Date.now();
  const due = remaining <= 0;
  if (session.phase === 'running') {
    await chrome.action.setBadgeText({ text: due ? '!' : 'FOCO' });
    await chrome.action.setBadgeBackgroundColor({ color: due ? COLOR_DUE : COLOR_FOCUS });
  } else {
    await chrome.action.setBadgeText({ text: due ? '!' : 'PAUSA' });
    await chrome.action.setBadgeBackgroundColor({ color: due ? COLOR_DUE : COLOR_BREAK });
  }
  if (remaining > 0) {
    await chrome.alarms.create('timer-end', { when: session.endsAt });
  } else {
    await chrome.alarms.clear('timer-end');
  }
}

chrome.runtime.onInstalled.addListener(reconcile);
chrome.runtime.onStartup.addListener(reconcile);
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'timer-end') return;
  const { session, soundEnabled } = await chrome.storage.local.get(['session', 'soundEnabled']);
  if (!session || !['running', 'break'].includes(session.phase) || session.endsAt > Date.now()) return;
  const isBreak = session?.phase === 'break';
  reconcile();
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon128.png'),
    title: 'KanbanDoro',
    message: isBreak ? 'Sua pausa acabou! Hora de voltar ao foco.' : 'O tempo do seu ciclo de foco acabou!',
    silent: true
  });
  if (soundEnabled !== false) playAlert(isBreak ? 'break' : 'focus');
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.session) {
    reconcile();
    broadcastTimer(changes.session.newValue || null);
  }
});
