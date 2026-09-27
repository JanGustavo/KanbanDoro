export type BlockingMode = 'off' | 'gentle' | 'strict' | 'custom';
export type FocusBlocking = { mode: BlockingMode; exceptions: string[]; customDomains: string[] };

export const focusBlockingDefault: FocusBlocking = { mode: 'off', exceptions: [], customDomains: [] };

// Only the top-level page is redirected; these domains never affect embedded resources.
export const gentleDomains = [
  'instagram.com', 'facebook.com', 'tiktok.com', 'x.com', 'twitter.com',
  'chess.com', 'lichess.org', 'twitch.tv',
  // Apostas — bloqueadas mesmo no modo mais leve.
  'bet365.com', 'stake.com', 'stake.bet', 'blaze.com', 'blaze.bet.br', 'betano.com',
  'betano.bet.br', 'betfair.com', 'bwin.com', 'sportingbet.com', '1xbet.com',
  'pixbet.com', 'betnacional.com.br', 'kto.com', 'betway.com', 'rivalry.com',
  'pokerstars.com', 'betmgm.com', 'draftkings.com', 'fanduel.com', 'casino.com',
  'bet7k.com', 'esportivabet.com', 'superbet.com', 'vaidebet.com', 'novibet.com',
  'parimatch.com', '22bet.com', 'betsson.com', 'rivalo.com', 'betwarrior.com',
  'betmotion.com', 'mrjack.bet', 'betaia.bet.br', 'esportedasorte.bet.br', 'betsul.com',
];
export const strictDomains = [
  ...gentleDomains, 'youtube.com', 'youtu.be', 'reddit.com', 'pinterest.com',
  'snapchat.com', 'discord.com', 'web.whatsapp.com', 'telegram.org',
  'netflix.com', 'primevideo.com', 'crunchyroll.com',
  // Jogos.
  'roblox.com', 'poki.com', 'crazygames.com', 'miniclip.com', 'epicgames.com',
  'steampowered.com', 'minecraft.net', 'ea.com', 'ubisoft.com', 'riotgames.com',
  'leagueoflegends.com', 'valorant.com', 'playstation.com', 'xbox.com', 'nintendo.com',
  'itch.io', 'kongregate.com', 'y8.com', 'friv.com', 'agar.io', 'slither.io',
];

export function normalizeDomain(value: string): string | null {
  try {
    const raw = value.trim().toLowerCase();
    if (!raw || /[\s@]/.test(raw)) return null;
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const domain = parsed.hostname.replace(/\.$/, '').replace(/^www\./, '');
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port ||
      domain.length > 253 || !domain.includes('.') || /^(?:\d+\.){3}\d+$/.test(domain) ||
      !domain.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))) return null;
    return domain;
  } catch { return null; }
}

export function blockedDomains(settings: FocusBlocking): string[] {
  const source = settings.mode === 'gentle' ? gentleDomains : settings.mode === 'strict' ? strictDomains : settings.mode === 'custom' ? settings.customDomains : [];
  const exceptions = new Set(settings.exceptions.map(normalizeDomain).filter(Boolean));
  return [...new Set(source.map(normalizeDomain).filter((domain): domain is string => !!domain))]
    .filter(domain => ![...exceptions].some(except => domain === except || domain.endsWith(`.${except}`)));
}
