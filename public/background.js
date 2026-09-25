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
  const { session } = await chrome.storage.local.get('session');
  const isBreak = session?.phase === 'break';
  reconcile();
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon128.png'),
    title: 'KanbanDoro',
    message: isBreak ? 'Sua pausa acabou! Hora de voltar ao foco.' : 'O tempo do seu ciclo de foco acabou!',
    silent: false
  });
  playAlert(isBreak ? 'break' : 'focus');
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.session) {
    reconcile();
    broadcastTimer(changes.session.newValue || null);
  }
});
