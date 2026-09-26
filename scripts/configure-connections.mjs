import { readFileSync, writeFileSync } from 'node:fs';

const manifestPath = 'dist/manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const clientId = process.env.KANBANDORO_GOOGLE_CLIENT_ID?.trim() ?? '';
const apiUrl = process.env.KANBANDORO_API_URL?.trim()?.replace(/\/$/, '') ?? '';
if (Boolean(clientId) !== Boolean(apiUrl)) throw Error('Configure KANBANDORO_GOOGLE_CLIENT_ID e KANBANDORO_API_URL juntos.');
if (clientId) {
  if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw Error('ID OAuth inválido. Use o tipo Aplicativo da Web.');
  const parsed = new URL(apiUrl);
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash ||
      (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))) {
    throw Error('KANBANDORO_API_URL deve ser uma origem HTTPS ou HTTP loopback, sem caminho.');
  }
  manifest.host_permissions.push(`${parsed.origin}/*`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync('dist/connections-config.json', `${JSON.stringify({ clientId, apiUrl })}\n`);
console.log(clientId ? 'Connections configuradas (cliente OAuth Web + API).' : 'Connections desabilitadas até configurar cliente OAuth Web e API.');
