#!/usr/bin/env bash
# Implanta somente a API KanbanDoro. Não instala Nginx nem copia segredos locais.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo 'Uso: bash scripts/deploy-vps.sh azureuser@SEU_IP /caminho/da/chave.pem' >&2
  exit 2
fi
remote=$1
key=$2
[[ $remote =~ ^[a-zA-Z_][a-zA-Z0-9_.-]*@[a-zA-Z0-9.:-]+$ ]] || { echo 'Informe usuario@host.' >&2; exit 2; }
[[ -f $key ]] || { echo "Chave SSH não encontrada: $key" >&2; exit 2; }
cd "$(dirname "$0")/.."
ssh_args=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$key")

echo 'Verificando SSH e Docker (sudo sem senha)...'
ssh "${ssh_args[@]}" "$remote" 'sudo -n docker info >/dev/null && sudo -n docker compose version >/dev/null' || {
  echo 'SSH ou Docker indisponível. Na VPS, teste: sudo -n docker ps -a' >&2
  exit 1
}
ssh "${ssh_args[@]}" "$remote" 'mkdir -p "$HOME/kanbandoro"'

echo 'Enviando apenas o backend e o Compose; backend/.env remoto é preservado.'
tar --exclude='__pycache__' --exclude='*.pyc' --exclude='*.db*' -cf - \
  compose.yaml backend/Dockerfile backend/.dockerignore backend/alembic.ini \
  backend/pyproject.toml backend/README.md backend/.env.example \
  backend/app backend/migrations | ssh "${ssh_args[@]}" "$remote" 'tar -xf - -C "$HOME/kanbandoro"'

ssh "${ssh_args[@]}" "$remote" 'bash -se' <<'REMOTE'
cd "$HOME/kanbandoro"
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  chmod 600 backend/.env
  echo 'Criei ~/kanbandoro/backend/.env a partir do exemplo. Preencha os segredos na VPS e rode o deploy novamente.' >&2
  exit 1
fi
chmod 600 backend/.env
if ! grep -Eq '^JWT_SECRET=.{32,}$' backend/.env || grep -q '^JWT_SECRET=substitua' backend/.env; then
  echo 'Configure JWT_SECRET com pelo menos 32 caracteres em ~/kanbandoro/backend/.env.' >&2
  exit 1
fi
if [[ -n $(sudo -n ss -H -ltn 'sport = :18080') ]] && [[ -z $(sudo -n docker compose -p kanbandoro ps -q api) ]]; then
  echo 'Porta 18080 ocupada por outro serviço; ajuste KANBANDORO_BIND_PORT antes de iniciar.' >&2
  exit 1
fi
# O Compose se conecta somente ao loopback; não publica Nginx de outros projetos.
sudo -n docker compose -p kanbandoro build api
if sudo -n docker volume inspect kanbandoro_kanbandoro_data >/dev/null 2>&1 && \
    sudo -n docker compose -p kanbandoro run --rm --no-deps api test -f /data/kanbandoro.db; then
  mkdir -p "$HOME/kanbandoro-backups"
  sudo -n docker compose -p kanbandoro run --rm --no-deps --user 0 \
    -v "$HOME/kanbandoro-backups:/backups" api python -m app.scripts.backup /backups
fi
sudo -n docker compose -p kanbandoro up -d --no-build
for attempt in {1..20}; do
  if curl -fsS --max-time 3 http://127.0.0.1:18080/health; then
    echo ' API pronta em 127.0.0.1:18080. Backup: ~/kanbandoro-backups/'
    exit 0
  fi
  sleep 2
done
echo 'Health check falhou; veja: sudo docker compose -p kanbandoro logs --tail=100 api' >&2
exit 1
REMOTE
