import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  normalizeDomain,
  blockedDomains,
  gentleDomains,
  strictDomains,
  groupFocusDomains,
} from '../src/focusBlocking.ts';

assert.equal(normalizeDomain('https://www.chess.com/play/online'), 'chess.com');
assert.equal(normalizeDomain('web.whatsapp.com'), 'web.whatsapp.com');
assert.equal(normalizeDomain('https://alice@chess.com'), null);
assert.equal(normalizeDomain('http://localhost:8000'), null);
assert.equal(normalizeDomain('https://example.com:8080'), null);
assert.equal(blockedDomains({ mode: 'off', exceptions: [], customDomains: [] }).length, 0);
assert(gentleDomains.every(domain => strictDomains.includes(domain)));
assert.equal(new Set(gentleDomains).size, gentleDomains.length, 'no duplicate domains in Essencial');
assert.equal(new Set(strictDomains).size, strictDomains.length, 'no duplicate domains in Intenso');
assert(
  [...gentleDomains, ...strictDomains].every(domain => normalizeDomain(domain) === domain),
  'all presets contain valid canonical domains',
);
assert(blockedDomains({ mode: 'gentle', exceptions: [], customDomains: [] }).includes('blaze.bet.br'));
assert(blockedDomains({ mode: 'strict', exceptions: [], customDomains: [] }).includes('agar.io'));
assert(!blockedDomains({ mode: 'gentle', exceptions: ['blaze.bet.br'], customDomains: [] }).includes('blaze.bet.br'));
assert(!blockedDomains({ mode: 'gentle', exceptions: ['chess.com'], customDomains: [] }).includes('chess.com'));
assert.deepEqual(
  blockedDomains({ mode: 'custom', exceptions: [], customDomains: ['work.example', 'work.example', 'invalid_host'] }),
  ['work.example'],
);
console.log('Perfis e exceções de domínios validados.');

// Existing presets keep their members, with the attachment's additions only in Intenso.
const additions = [
  'kwai.com',
  'snackvideo.com',
  'likee.video',
  'threads.com',
  'bsky.app',
  'tumblr.com',
  '9gag.com',
  'kick.com',
  'rumble.com',
  'steamcommunity.com',
  'gog.com',
  'betboom.bet.br',
  'br4.bet.br',
  'estrelabet.bet.br',
  'vbet.bet.br',
];
assert.equal(strictDomains.length, 91);
assert.deepEqual([...gentleDomains].sort(), [
  '1xbet.com',
  '22bet.com',
  'bet365.com',
  'bet7k.com',
  'betaia.bet.br',
  'betano.bet.br',
  'betano.com',
  'betfair.com',
  'betmgm.com',
  'betmotion.com',
  'betnacional.com.br',
  'betsson.com',
  'betsul.com',
  'betwarrior.com',
  'betway.com',
  'blaze.bet.br',
  'blaze.com',
  'bwin.com',
  'casino.com',
  'chess.com',
  'draftkings.com',
  'esportedasorte.bet.br',
  'esportivabet.com',
  'facebook.com',
  'fanduel.com',
  'instagram.com',
  'kto.com',
  'lichess.org',
  'mrjack.bet',
  'novibet.com',
  'parimatch.com',
  'pixbet.com',
  'pokerstars.com',
  'rivalo.com',
  'rivalry.com',
  'sportingbet.com',
  'stake.bet',
  'stake.com',
  'superbet.com',
  'tiktok.com',
  'twitch.tv',
  'twitter.com',
  'vaidebet.com',
  'x.com',
]);
assert(
  [
    'instagram.com',
    'facebook.com',
    'tiktok.com',
    'x.com',
    'twitter.com',
    'chess.com',
    'lichess.org',
    'twitch.tv',
    'bet365.com',
    'stake.com',
    'stake.bet',
    'blaze.com',
    'blaze.bet.br',
    'betano.com',
    'betano.bet.br',
    'betfair.com',
    'bwin.com',
    'sportingbet.com',
    '1xbet.com',
    'pixbet.com',
    'betnacional.com.br',
    'kto.com',
    'betway.com',
    'rivalry.com',
    'pokerstars.com',
    'betmgm.com',
    'draftkings.com',
    'fanduel.com',
    'casino.com',
    'bet7k.com',
    'esportivabet.com',
    'superbet.com',
    'vaidebet.com',
    'novibet.com',
    'parimatch.com',
    '22bet.com',
    'betsson.com',
    'rivalo.com',
    'betwarrior.com',
    'betmotion.com',
    'mrjack.bet',
    'betaia.bet.br',
    'esportedasorte.bet.br',
    'betsul.com',
    'youtube.com',
    'youtu.be',
    'reddit.com',
    'pinterest.com',
    'snapchat.com',
    'discord.com',
    'web.whatsapp.com',
    'telegram.org',
    'netflix.com',
    'primevideo.com',
    'crunchyroll.com',
    'roblox.com',
    'poki.com',
    'crazygames.com',
    'miniclip.com',
    'epicgames.com',
    'steampowered.com',
    'minecraft.net',
    'ea.com',
    'ubisoft.com',
    'riotgames.com',
    'leagueoflegends.com',
    'valorant.com',
    'playstation.com',
    'xbox.com',
    'nintendo.com',
    'itch.io',
    'kongregate.com',
    'y8.com',
    'friv.com',
    'agar.io',
    'slither.io',
  ].every(domain => strictDomains.includes(domain)),
);
assert(additions.every(domain => strictDomains.includes(domain) && !gentleDomains.includes(domain)));
assert(
  !blockedDomains({ mode: 'strict', exceptions: ['whatsapp.com'], customDomains: [] }).includes('web.whatsapp.com'),
);
const categories = groupFocusDomains(strictDomains);
assert.deepEqual(categories.flatMap(group => group.domains).sort(), [...strictDomains].sort());
assert.equal(categories.find(group => group.id === 'games').domains.includes('steamcommunity.com'), true);
assert.equal(categories.find(group => group.id === 'betting').domains.includes('vbet.bet.br'), true);
assert.deepEqual(
  groupFocusDomains(['m.instagram.com', 'work.example', 'work.example', 'invalid_host']).map(group => ({
    id: group.id,
    domains: group.domains,
  })),
  [
    { id: 'social', domains: ['m.instagram.com'] },
    { id: 'other', domains: ['work.example'] },
  ],
);
assert.deepEqual(groupFocusDomains([]), []);
const presetBlock = readFileSync('public/background.js', 'utf8').match(
  /const FOCUS_GENTLE = \[[\s\S]*?;\s*const FOCUS_STRICT = \[[\s\S]*?;/,
)?.[0];
assert(presetBlock, 'Worker presets must exist');
const worker = vm.runInNewContext(`${presetBlock}; ({ gentle: FOCUS_GENTLE, strict: FOCUS_STRICT })`);
assert.deepEqual(Array.from(worker.gentle).sort(), [...gentleDomains].sort(), 'Essencial must match the worker');
assert.deepEqual(Array.from(worker.strict).sort(), [...strictDomains].sort(), 'Intenso must match the worker');
console.log('Categorias, novos domínios, exceções e paridade entre interface/bloqueador validados.');
