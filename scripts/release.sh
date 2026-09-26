#!/usr/bin/env bash
set -euo pipefail

version=${1:-}
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Uso: make release VERSION=0.2.0' >&2
  exit 1
fi
if [[ $(git branch --show-current) != main || -n $(git status --porcelain) ]]; then
  echo 'A release precisa partir da main atualizada e sem alterações locais.' >&2
  exit 1
fi
git fetch origin main --tags
if [[ $(git rev-parse HEAD) != $(git rev-parse origin/main) ]]; then
  echo 'Atualize a main antes de criar a release.' >&2
  exit 1
fi
if git rev-parse "v$version" >/dev/null 2>&1; then
  echo "A tag v$version já existe." >&2
  exit 1
fi
node - "$version" <<'NODE'
const fs = require('node:fs');
const version = process.argv[2];
for (const path of ['package.json', 'package-lock.json', 'public/manifest.json']) {
  const actual = JSON.parse(fs.readFileSync(path, 'utf8')).version;
  if (actual !== version) throw Error(`${path}: versão ${actual}; esperado ${version}`);
}
NODE
npm ci
npm run build
npm test
git tag -a "v$version" -m "KanbanDoro $version"
git push origin "v$version"
echo "Tag v$version enviada. A GitHub Action criará a Release com o pacote dist."
