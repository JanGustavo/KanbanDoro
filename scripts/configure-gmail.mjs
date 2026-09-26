import { readFileSync, writeFileSync } from 'node:fs';

const path = 'dist/manifest.json';
const manifest = JSON.parse(readFileSync(path, 'utf8'));
const clientId = process.env.KANBANDORO_GOOGLE_CLIENT_ID?.trim();
if (clientId) {
  if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    throw Error('KANBANDORO_GOOGLE_CLIENT_ID deve ser um client ID OAuth do Google.');
  }
  manifest.oauth2 = { client_id: clientId, scopes: ['https://www.googleapis.com/auth/gmail.readonly'] };
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('OAuth do Gmail configurado no manifesto da extensão.');
} else {
  console.log('OAuth do Gmail indisponível: defina KANBANDORO_GOOGLE_CLIENT_ID para ativar Connections.');
}
