import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = fileURLToPath(new URL('../backend/.env', import.meta.url));
let clientId = process.env.KANBANDORO_GOOGLE_CLIENT_ID?.trim();
if (!clientId && existsSync(envPath)) {
  const value = readFileSync(envPath, 'utf8').match(/^GOOGLE_CLIENT_ID\s*=\s*(.+)\s*$/m)?.[1]?.trim();
  clientId = value?.replace(/^['"]|['"]$/g, '');
}
if (!clientId) {
  console.error('Falta GOOGLE_CLIENT_ID em backend/.env. Configure o cliente OAuth Web antes de compilar Connections.');
  process.exit(1);
}
const result = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    KANBANDORO_GOOGLE_CLIENT_ID: clientId,
    KANBANDORO_API_URL: process.env.KANBANDORO_API_URL || 'http://127.0.0.1:8000'
  }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
