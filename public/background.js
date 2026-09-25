chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('index.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs[0]?.id) return chrome.tabs.update(tabs[0].id, { active: true });
  return chrome.tabs.create({ url });
});

async function reconcile() {
  const { session } = await chrome.storage.local.get('session');
  if (!session || session.phase !== 'running') {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const remaining = session.endsAt - Date.now();
  await chrome.action.setBadgeText({ text: remaining > 0 ? 'FOCO' : '!' });
  await chrome.action.setBadgeBackgroundColor({ color: '#8f2948' });
  if (remaining > 0) {
    await chrome.alarms.create('focus-end', { when: session.endsAt });
  } else {
    await chrome.alarms.clear('focus-end');
  }
}

chrome.runtime.onInstalled.addListener(reconcile);
chrome.runtime.onStartup.addListener(reconcile);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focus-end') reconcile();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.session) reconcile();
});
