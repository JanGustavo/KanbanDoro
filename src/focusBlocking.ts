export type BlockingMode = 'off' | 'gentle' | 'strict' | 'custom';
export type FocusBlocking = { mode: BlockingMode; exceptions: string[]; customDomains: string[] };

export const focusBlockingDefault: FocusBlocking = { mode: 'off', exceptions: [], customDomains: [] };

// Only the top-level page is redirected; these domains never affect embedded resources.
export const gentleDomains = [
  'instagram.com', 'facebook.com', 'tiktok.com', 'x.com', 'twitter.com',
  'chess.com', 'lichess.org', 'twitch.tv', 'stake.com', 'bet365.com'
];
export const strictDomains = [
  ...gentleDomains, 'youtube.com', 'youtu.be', 'reddit.com', 'pinterest.com',
  'snapchat.com', 'discord.com', 'web.whatsapp.com', 'telegram.org',
  'netflix.com', 'primevideo.com', 'crunchyroll.com', 'roblox.com',
  'poki.com', 'crazygames.com', 'miniclip.com', 'epicgames.com', 'steampowered.com'
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
