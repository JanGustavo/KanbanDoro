async function openBoard() {
  const url = chrome.runtime.getURL('index.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs[0]?.id) return chrome.tabs.update(tabs[0].id, { active: true });
  return chrome.tabs.create({ url });
}
chrome.action.onClicked.addListener(openBoard);

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
    chrome.tabs.query({}).then(tabs => Promise.all(tabs.filter(tab => tab.id).map(tab =>
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TIMER' }).catch(() => {})
    )));
  }
});

async function broadcastTimer(session) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.filter(tab => tab.id).map(tab =>
    chrome.tabs.sendMessage(tab.id, { type: 'TIMER_CHANGED', session }).catch(() => {})
  ));
}

async function reconcile() {
  const { session } = await chrome.storage.local.get('session');
  if (!session || (session.phase !== 'running' && session.phase !== 'break')) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const remaining = session.endsAt - Date.now();
  if (session.phase === 'running') {
    await chrome.action.setBadgeText({ text: remaining > 0 ? 'FOCO' : '!' });
  } else {
    await chrome.action.setBadgeText({ text: remaining > 0 ? 'PAUSA' : '!' });
  }
  await chrome.action.setBadgeBackgroundColor({ color: '#8f2948' });
  if (remaining > 0) {
    await chrome.alarms.create('timer-end', { when: session.endsAt });
  } else {
    await chrome.alarms.clear('timer-end');
  }
}

chrome.runtime.onInstalled.addListener(reconcile);
chrome.runtime.onStartup.addListener(reconcile);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timer-end') {
    reconcile();
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon128.png'),
      title: 'KanbanDoro',
      message: 'O tempo do seu ciclo acabou!',
      silent: false
    });
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.session) {
    reconcile();
    broadcastTimer(changes.session.newValue || null);
  }
});
