#!/usr/bin/env bash
# Publica o site estático e expõe somente Connections da API sob HTTPS.
set -euo pipefail
if [[ $# -ne 4 ]]; then
  echo 'Uso: bash scripts/deploy-site.sh kanbandoro.jangustavo.me azureuser@IP /caminho/chave.pem email-certbot' >&2
  exit 2
fi
domain=$1
remote=$2
key=$3
email=$4
[[ $domain =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*\.(me|tech)$ && $domain != *..* ]] || { echo 'Informe o nome completo do site (.me ou .tech), sem protocolo.' >&2; exit 2; }
[[ $remote =~ ^[a-zA-Z_][a-zA-Z0-9_.-]*@[0-9.]+$ ]] || { echo 'Informe usuario@IPv4.' >&2; exit 2; }
[[ -f $key ]] || { echo "Chave não encontrada: $key" >&2; exit 2; }
[[ $email == *@*.* ]] || { echo 'Informe um e-mail para o certificado HTTPS.' >&2; exit 2; }
ip=${remote#*@}
for host in "$domain" "api.$domain"; do
  if ! getent ahostsv4 "$host" | awk '{print $1}' | grep -Fxq "$ip"; then
    echo "DNS não aponta $host para $ip. Crie/aguarde os registros A antes do deploy." >&2
    exit 1
  fi
done
cd "$(dirname "$0")/.."
ssh_args=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$key")
ssh "${ssh_args[@]}" "$remote" 'sudo -n nginx -t >/dev/null && sudo -n certbot --version >/dev/null && mkdir -p "$HOME/kanbandoro-site"'
ssh "${ssh_args[@]}" "$remote" bash -se -- "$domain" <<'REMOTE'
domain=$1
if ! sudo -n test -e /etc/nginx/sites-available/kanbandoro; then
  active=$(sudo -n nginx -T 2>/dev/null)
  if printf '%s\n' "$active" | grep -Fq "server_name $domain;" || printf '%s\n' "$active" | grep -Fq "server_name api.$domain;"; then
    echo 'Este domínio já está configurado em outro site Nginx. Deploy interrompido.' >&2
    exit 1
  fi
fi
REMOTE
# O domínio foi validado acima: pode ser usado como substituição literal no modelo.
sed "s/__DOMAIN__/$domain/g" deploy/nginx-kanbandoro.conf.template | \
  ssh "${ssh_args[@]}" "$remote" 'cat > "$HOME/kanbandoro.nginx"'
tar -C site -cf - index.html style.css icon.svg | ssh "${ssh_args[@]}" "$remote" 'tar -xf - -C "$HOME/kanbandoro-site"'
# Se já existe HTTPS, preserva a configuração gerenciada pelo Certbot.
nginx_result=$(ssh "${ssh_args[@]}" "$remote" 'bash -se' <<'REMOTE'
sudo -n install -d -m 755 /var/www/kanbandoro
sudo -n cp -a "$HOME/kanbandoro-site/." /var/www/kanbandoro/
sudo -n find /var/www/kanbandoro -type f -exec chmod 644 {} +
sudo -n find /var/www/kanbandoro -type d -exec chmod 755 {} +
if sudo -n test -f /etc/nginx/sites-available/kanbandoro && sudo -n grep -q 'managed by Certbot' /etc/nginx/sites-available/kanbandoro; then
  sudo -n nginx -t && sudo -n systemctl reload nginx
  echo 'HTTPS_EXISTENTE'
  exit 0
fi
if sudo -n test -f /etc/nginx/sites-available/kanbandoro; then
  sudo -n cp /etc/nginx/sites-available/kanbandoro /etc/nginx/sites-available/kanbandoro.previous
fi
sudo -n cp "$HOME/kanbandoro.nginx" /etc/nginx/sites-available/kanbandoro
sudo -n ln -sfn /etc/nginx/sites-available/kanbandoro /etc/nginx/sites-enabled/kanbandoro
if ! sudo -n nginx -t; then
  if sudo -n test -f /etc/nginx/sites-available/kanbandoro.previous; then
    sudo -n cp /etc/nginx/sites-available/kanbandoro.previous /etc/nginx/sites-available/kanbandoro
  else
    sudo -n rm -f /etc/nginx/sites-enabled/kanbandoro /etc/nginx/sites-available/kanbandoro
  fi
  echo 'Nginx inválido; configuração anterior preservada.' >&2
  exit 1
fi
sudo -n systemctl reload nginx
REMOTE
)
if [[ $nginx_result == *HTTPS_EXISTENTE* ]]; then
  echo "Página atualizada: https://$domain/ (HTTPS existente preservado)"
  exit 0
fi
ssh "${ssh_args[@]}" "$remote" sudo -n certbot --nginx --redirect --non-interactive --agree-tos \
  --email "$email" -d "$domain" -d "api.$domain"
echo "Site: https://$domain/"
echo "API Connections: https://api.$domain/connections/google/"
