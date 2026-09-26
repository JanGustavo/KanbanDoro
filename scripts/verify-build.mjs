import { readFileSync, existsSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
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
console.log('Manifest V3: scripts de conteúdo independentes e presentes no dist.');
