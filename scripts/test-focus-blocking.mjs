import assert from 'node:assert/strict';
import { normalizeDomain, blockedDomains, gentleDomains, strictDomains } from '../src/focusBlocking.ts';

assert.equal(normalizeDomain('https://www.chess.com/play/online'), 'chess.com');
assert.equal(normalizeDomain('web.whatsapp.com'), 'web.whatsapp.com');
assert.equal(normalizeDomain('https://alice@chess.com'), null);
assert.equal(normalizeDomain('http://localhost:8000'), null);
assert.equal(normalizeDomain('https://example.com:8080'), null);
assert.equal(blockedDomains({ mode: 'off', exceptions: [], customDomains: [] }).length, 0);
assert(gentleDomains.every(domain => strictDomains.includes(domain)));
assert.equal(new Set(gentleDomains).size, gentleDomains.length, 'no duplicate domains in Essencial');
assert.equal(new Set(strictDomains).size, strictDomains.length, 'no duplicate domains in Intenso');
assert([...gentleDomains, ...strictDomains].every(domain => normalizeDomain(domain) === domain), 'all presets contain valid canonical domains');
assert(blockedDomains({ mode: 'gentle', exceptions: [], customDomains: [] }).includes('blaze.bet.br'));
assert(blockedDomains({ mode: 'strict', exceptions: [], customDomains: [] }).includes('agar.io'));
assert(!blockedDomains({ mode: 'gentle', exceptions: ['blaze.bet.br'], customDomains: [] }).includes('blaze.bet.br'));
assert(!blockedDomains({ mode: 'gentle', exceptions: ['chess.com'], customDomains: [] }).includes('chess.com'));
assert.deepEqual(blockedDomains({ mode: 'custom', exceptions: [], customDomains: ['work.example', 'work.example', 'invalid_host'] }), ['work.example']);
console.log('Perfis e exceções de domínios validados.');
