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
const chrome = {
  action: { onClicked: { addListener(fn) { listeners.click = fn; } }, setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  runtime: { getURL: path => path, sendMessage: async message => { if (message.type === 'PLAY_ALERT') alerts++; }, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { listeners.message = fn; } } },
  storage: { local: { setAccessLevel: async () => {}, get: async () => ({ session, soundEnabled }) }, onChanged: { addListener() {} } },
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
vm.runInNewContext(readFileSync('dist/background.js', 'utf8'), { chrome });
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
