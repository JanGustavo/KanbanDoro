# Landing page KanbanDoro

Site estático em HTML/CSS em `kanbandoro.jangustavo.me/`. O domínio raiz `jangustavo.me` e os subdomínios dos outros projetos não são modificados. Sem coleta de dados, scripts externos ou promessas clínicas. Os exemplos de tarefa e IA são ilustrativos; a instalação real da extensão é feita pelo repositório GitHub.

Para visualizar localmente: `python3 -m http.server 4173 --directory site`, depois abra `http://127.0.0.1:4173/`.

## Publicar

Crie dois registros **A** na zona DNS que é autoritativa para `jangustavo.me` (na Namecheap, apenas se os nameservers desse domínio estiverem apontados para ela):

| Host | IPv4 | Destino |
| --- | --- | --- |
| `kanbandoro` | `64.236.155.209` | Página estática |
| `api.kanbandoro` | `64.236.155.209` | Connections da API |

Isso não altera `@`, `www`, `api` ou outros registros existentes. O script interrompe o deploy se os dois nomes ainda não resolverem para a VPS ou se outro site no Nginx já usar algum deles.

Depois, execute da raiz do repositório local:

```bash
bash scripts/deploy-site.sh kanbandoro.jangustavo.me azureuser@64.236.155.209 /caminho/vm-docker_key.pem seu-email@exemplo.com
```

O script valida DNS, envia os arquivos de `site/`, testa o Nginx antes de recarregar e solicita certificado HTTPS com Certbot. A configuração [Nginx](../deploy/nginx-kanbandoro.conf.template) publica apenas `/health` e `/connections/google/` no subdomínio da API. Rotas experimentais `/auth`, `/tasks`, `/sessions` e `/docs` não são expostas. É necessário que Certbot já esteja instalado no servidor e que as portas 80/443 estejam acessíveis.

Depois de conferir `https://api.kanbandoro.jangustavo.me/health`, reconstrua a extensão **no computador** para apontar à API remota:

```bash
KANBANDORO_API_URL=https://api.kanbandoro.jangustavo.me npm run build:local
```

Recarregue `dist` nas extensões do navegador. O ID público OAuth continua vindo de `backend/.env`; o segredo nunca entra no build. Confira `CORS_ORIGINS` no `.env` da VPS para permitir `chrome-extension://<ID>` e reinicie a API se alterar esse arquivo.
