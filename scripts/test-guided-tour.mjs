import assert from 'node:assert/strict';
import { GuidedTour, placeTourPopover } from '../src/guidedTour.ts';

assert.deepEqual(placeTourPopover({ top: 30, bottom: 50, left: 10, width: 30 }, 180, 100, 300, 200), { top: 62, left: 12 });
assert.deepEqual(placeTourPopover({ top: 150, bottom: 180, left: 270, width: 20 }, 180, 100, 300, 200), { top: 38, left: 108 });

const documentListeners = new Map();
const windowListeners = new Map();
class FakeElement {
  children = [];
  listeners = new Map();
  classes = new Set();
  classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name) };
  style = {};
  isConnected = true;
  className = '';
  constructor(tag = 'div') { this.tag = tag; }
  append(...children) { this.children.push(...children); children.forEach(child => child.parent = this); }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute() {}
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  getClientRects() { return [this.getBoundingClientRect()]; }
  getBoundingClientRect() { return this.tag === 'section' ? { top: 0, left: 0, bottom: 100, width: 180, height: 100 } : { top: 30, left: 10, bottom: 50, width: 30, height: 20 }; }
  scrollIntoView() {}
  focus() { globalThis.document.activeElement = this; }
  querySelectorAll(tag) { return this.children.flatMap(child => [child, ...child.querySelectorAll(tag)]).filter(child => child.tag === tag); }
}
globalThis.HTMLElement = FakeElement;
const first = new FakeElement();
const last = new FakeElement();
const trigger = new FakeElement('button');
const body = new FakeElement('body');
globalThis.document = { body, activeElement: trigger, createElement: tag => new FakeElement(tag),
  querySelector: selector => selector === '#first' ? first : selector === '#last' ? last : null,
  addEventListener: (type, listener) => documentListeners.set(type, listener), removeEventListener: type => documentListeners.delete(type) };
globalThis.window = { innerWidth: 300, innerHeight: 200, addEventListener: (type, listener) => windowListeners.set(type, listener), removeEventListener: type => windowListeners.delete(type) };
globalThis.getComputedStyle = () => ({ visibility: 'visible' });
globalThis.requestAnimationFrame = callback => { callback(); return 1; };
globalThis.cancelAnimationFrame = () => {};
let seen = false;
const events = [];
const tour = new GuidedTour({ steps: [
  { selector: '#first', title: 'Primeiro', description: 'Um' },
  { selector: '#missing', title: 'Ausente', description: 'Dois' },
  { selector: '#last', title: 'Terceiro', description: 'Três' },
], storage: { get: () => seen, set: value => { seen = value; } },
  onStart: () => events.push('start'), onStepChange: (_step, index) => events.push(index),
  onComplete: () => events.push('complete'), onSkip: () => events.push('skip') });
assert.equal(await tour.start(), true);
assert(first.classList.contains('kb-tour-target'));
let popover = body.children.find(child => child.className === 'kb-tour-popover');
popover.querySelectorAll('button')[1].listeners.get('click')();
assert(!first.classList.contains('kb-tour-target'));
assert(last.classList.contains('kb-tour-target'), 'missing targets are skipped');
popover = body.children.find(child => child.className === 'kb-tour-popover');
popover.querySelectorAll('button')[1].listeners.get('click')();
await Promise.resolve();
assert.deepEqual(events, ['start', 0, 2, 'complete']);
assert(seen);
assert.equal(body.children.length, 0, 'overlay and popover are removed');
assert(!last.classList.contains('kb-tour-target'));
assert.equal(documentListeners.size, 0);
assert.equal(windowListeners.size, 0);
assert.equal(document.activeElement, trigger);
assert.equal(await tour.start(), false, 'completed tour does not automatically start again');
assert.equal(await tour.start({ force: true }), true, 'manual replay works');
documentListeners.get('keydown')({ key: 'Escape', preventDefault() {} });
await Promise.resolve();
assert.deepEqual(events.slice(-2), [0, 'skip']);
assert.equal(body.children.length, 0);
console.log('Tour: posicionamento, etapas ausentes, replay, saída e limpeza validados.');
