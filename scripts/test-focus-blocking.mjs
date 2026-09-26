import assert from 'node:assert/strict';
import { normalizeDomain, blockedDomains, gentleDomains, strictDomains } from '../src/focusBlocking.ts';

assert.equal(normalizeDomain('https://www.chess.com/play/online'), 'chess.com');
assert.equal(normalizeDomain('web.whatsapp.com'), 'web.whatsapp.com');
assert.equal(normalizeDomain('https://alice@chess.com'), null);
assert.equal(normalizeDomain('http://localhost:8000'), null);
assert.equal(normalizeDomain('https://example.com:8080'), null);
assert.equal(blockedDomains({ mode: 'off', exceptions: [], customDomains: [] }).length, 0);
assert(gentleDomains.every(domain => strictDomains.includes(domain)));
assert(!blockedDomains({ mode: 'gentle', exceptions: ['chess.com'], customDomains: [] }).includes('chess.com'));
assert.deepEqual(blockedDomains({ mode: 'custom', exceptions: [], customDomains: ['work.example', 'work.example', 'invalid_host'] }), ['work.example']);
console.log('Perfis e exceções de domínios validados.');
