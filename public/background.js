chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('index.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs[0]?.id) return chrome.tabs.update(tabs[0].id, { active: true });
  return chrome.tabs.create({ url });
});

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
  if (alarm.name === 'timer-end') reconcile();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.session) reconcile();
});
