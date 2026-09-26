# Landing page KanbanDoro

Site estático em HTML/CSS na raiz do domínio `.tech` escolhido. Sem coleta de dados, scripts externos ou promessas clínicas. Os exemplos de tarefa e IA são ilustrativos; a instalação real da extensão é feita pelo repositório GitHub.

Para visualizar localmente: `python3 -m http.server 4173 --directory site`, depois abra `http://127.0.0.1:4173/`.

## Publicar

Primeiro, crie os registros DNS **A** para `dominio.tech` e `api.dominio.tech`, ambos apontando para o IPv4 da VPS. Depois, execute da raiz do repositório local:

No domínio escolhido, os nomes são `jangustavo.tech` e `api.jangustavo.tech`. Ambos precisam de registros **A** para o IPv4 da VPS; o script verifica isso e interrompe a publicação enquanto o DNS não estiver pronto. Verifique também que esses nomes não servem outro projeto no Nginx.

```bash
bash scripts/deploy-site.sh jangustavo.tech azureuser@SEU_IP /caminho/vm-docker_key.pem seu-email@dominio.tech
```

O script valida DNS, envia os arquivos de `site/`, testa o Nginx antes de recarregar e solicita certificado HTTPS com Certbot. A configuração [Nginx](../deploy/nginx-kanbandoro.conf.template) publica apenas `/health` e `/connections/google/` no subdomínio da API. Rotas experimentais `/auth`, `/tasks`, `/sessions` e `/docs` não são expostas. É necessário que Certbot já esteja instalado no servidor e que as portas 80/443 estejam acessíveis.

Depois de conferir `https://api.dominio.tech/health`, reconstrua a extensão **no computador** para apontar à API remota:

```bash
KANBANDORO_API_URL=https://api.dominio.tech npm run build:local
```

Recarregue `dist` nas extensões do navegador. O ID público OAuth continua vindo de `backend/.env`; o segredo nunca entra no build. Confira `CORS_ORIGINS` no `.env` da VPS para permitir `chrome-extension://<ID>` e reinicie a API se alterar esse arquivo.
