import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
class Element {
  children = [];
  style = {};
  attributes = {};
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
  removeAttribute(key) {
    delete this.attributes[key];
  }
  attachShadow() {
    this.shadow = new Element();
    return this.shadow;
  }
}
const document = { body: new Element(), createElement: () => new Element() };
let listener;
let tick;
let preferences = { mode: 'compact', position: 'right' };
const messages = [];
vm.runInNewContext(readFileSync('.test-dist/content.js', 'utf8'), {
  document,
  Date,
  window: {
    setInterval: fn => {
      tick = fn;
    },
  },
  chrome: {
    runtime: {
      getURL: path => path,
      onMessage: {
        addListener: fn => {
          listener = fn;
        },
      },
      sendMessage: async message => {
        messages.push(message);
        if (message.type === 'GET_TIMER')
          return { session: { phase: 'running', endsAt: Date.now() + 60000 }, preferences };
        if (message.type === 'SET_BUBBLE_SETTINGS') {
          preferences = message.preferences;
          return { preferences };
        }
        return { opened: true };
      },
    },
  },
});
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
await flush();
const host = document.body.children[0];
const bubble = host.shadow.children[1];
assert.equal(bubble.className, 'timer compact');
assert.equal(bubble.attributes.role, 'button');
bubble.onkeydown({ key: 'Enter', preventDefault() {} });
await flush();
assert.equal(bubble.className, 'timer open');
const body = bubble.children[1];
const actions = bubble.children[2];
body.onclick();
actions.children[0].onclick();
await flush();
assert.equal(messages.filter(message => message.type === 'OPEN_BOARD').length, 2);
tick();
assert.equal(bubble.children[2], actions, 'Clock ticks must not recreate focused controls');
actions.children[1].onclick();
await flush();
assert.equal(bubble.className, 'timer compact');
listener({ type: 'BUBBLE_SETTINGS_CHANGED', preferences: { mode: 'open', position: 'left' } }, {}, () => {});
assert(host.style.cssText.includes('left:20px'));
assert(!host.style.cssText.includes('right:20px'));
bubble.children[2].children[2].onclick();
await flush();
assert.equal(host.style.display, 'none');
listener({ type: 'TIMER_CHANGED', session: { phase: 'break', endsAt: Date.now() + 60000 } }, {}, () => {});
assert.equal(host.style.display, 'none', 'A phase transition must respect hidden mode');
listener({ type: 'BUBBLE_SETTINGS_CHANGED', preferences: { mode: 'open', position: 'right' } }, {}, () => {});
listener({ type: 'TIMER_CHANGED', session: null }, {}, () => {});
assert.equal(host.style.display, 'none', 'No active cycle means no floating timer');
assert.equal(document.body.children.length, 1, 'Collapsing must not add another host');
console.log('Bolha: cliques, teclado, controles estáveis, posição, ocultação e ciclo ausente validados.');
