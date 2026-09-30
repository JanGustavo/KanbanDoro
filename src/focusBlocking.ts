export type BlockingMode = 'off' | 'gentle' | 'strict' | 'custom';
export type FocusBlocking = { mode: BlockingMode; exceptions: string[]; customDomains: string[] };

export const focusBlockingDefault: FocusBlocking = { mode: 'off', exceptions: [], customDomains: [] };

// Each preset domain belongs to one category; strict adds to the gentle profile.
export const focusDomainCategories: { id: string; title: string; gentle: string[]; strict: string[] }[] = [
  {
    id: 'social',
    title: 'Redes sociais e feeds',
    gentle: ['instagram.com', 'facebook.com', 'x.com', 'twitter.com'],
    strict: ['reddit.com', 'pinterest.com', 'snapchat.com', 'threads.com', 'bsky.app', 'tumblr.com', '9gag.com'],
  },
  {
    id: 'messaging',
    title: 'Mensagens e comunidades',
    gentle: [],
    strict: ['discord.com', 'web.whatsapp.com', 'telegram.org'],
  },
  {
    id: 'short-video',
    title: 'Vídeos curtos',
    gentle: ['tiktok.com'],
    strict: ['kwai.com', 'snackvideo.com', 'likee.video'],
  },
  {
    id: 'streaming',
    title: 'Vídeos, lives e streaming',
    gentle: ['twitch.tv'],
    strict: ['youtube.com', 'youtu.be', 'netflix.com', 'primevideo.com', 'crunchyroll.com', 'kick.com', 'rumble.com'],
  },
  {
    id: 'games',
    title: 'Jogos e lojas de jogos',
    gentle: ['chess.com', 'lichess.org'],
    strict: [
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
      'steamcommunity.com',
      'gog.com',
    ],
  },
  {
    id: 'betting',
    title: 'Apostas e cassinos',
    gentle: [
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
    ],
    strict: ['betboom.bet.br', 'br4.bet.br', 'estrelabet.bet.br', 'vbet.bet.br'],
  },
];
export const gentleDomains = focusDomainCategories.flatMap(category => category.gentle);
export const strictDomains = [...gentleDomains, ...focusDomainCategories.flatMap(category => category.strict)];

/** Presentation only: categorizing a domain never broadens the blocking rule. */
export function groupFocusDomains(domains: string[]): { id: string; title: string; domains: string[] }[] {
  const groups = focusDomainCategories.map(category => ({
    id: category.id,
    title: category.title,
    domains: [] as string[],
  }));
  const others = { id: 'other', title: 'Outros sites', domains: [] as string[] };
  for (const domain of [...new Set(domains.map(normalizeDomain).filter((item): item is string => !!item))]) {
    const index = focusDomainCategories.findIndex(category =>
      [...category.gentle, ...category.strict].some(
        known => domain === known || domain.endsWith(`.${known}`) || known.endsWith(`.${domain}`),
      ),
    );
    (index < 0 ? others : groups[index]).domains.push(domain);
  }
  return [...groups, others].filter(group => group.domains.length > 0);
}

export function normalizeDomain(value: string): string | null {
  try {
    const raw = value.trim().toLowerCase();
    if (!raw || /[\s@]/.test(raw)) return null;
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const domain = parsed.hostname.replace(/\.$/, '').replace(/^www\./, '');
    if (
      !['https:', 'http:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      domain.length > 253 ||
      !domain.includes('.') ||
      /^(?:\d+\.){3}\d+$/.test(domain) ||
      !domain.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))
    )
      return null;
    return domain;
  } catch {
    return null;
  }
}

export function blockedDomains(settings: FocusBlocking): string[] {
  const source =
    settings.mode === 'gentle'
      ? gentleDomains
      : settings.mode === 'strict'
        ? strictDomains
        : settings.mode === 'custom'
          ? settings.customDomains
          : [];
  const exceptions = new Set(settings.exceptions.map(normalizeDomain).filter(Boolean));
  return [...new Set(source.map(normalizeDomain).filter((domain): domain is string => !!domain))].filter(
    domain => ![...exceptions].some(except => domain === except || domain.endsWith(`.${except}`)),
  );
}
