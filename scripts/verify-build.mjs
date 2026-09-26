import { readFileSync, existsSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
if (manifest.version !== pkg.version || lock.version !== pkg.version) {
  throw new Error('Versões de manifest.json, package.json e package-lock.json devem coincidir');
}
for (const script of manifest.content_scripts.flatMap(entry => entry.js)) {
  const path = `dist/${script}`;
  if (!existsSync(path)) throw new Error(`Content script ausente: ${path}`);
  const source = readFileSync(path, 'utf8');
  if (!source.startsWith('(function()') || /^\s*import\b/m.test(source)) {
    throw new Error(`${path} deve ser independente e executável como script clássico`);
  }
}
for (const path of ['offscreen.html', 'offscreen.js']) {
  if (!existsSync(`dist/${path}`)) throw new Error(`Aviso sonoro ausente: dist/${path}`);
}
for (const path of ['focus-blocked.html', 'focus-blocked.js', 'focus-blocked.css']) {
  if (!existsSync(`dist/${path}`)) throw new Error(`Tela de foco ausente: dist/${path}`);
}
if (!manifest.permissions.includes('declarativeNetRequest') || !manifest.web_accessible_resources?.some(entry => entry.resources.includes('focus-blocked.html'))) {
  throw new Error('Permissão e tela de bloqueio de foco precisam constar no manifesto');
}
console.log('Manifest V3: scripts de conteúdo independentes e presentes no dist.');
