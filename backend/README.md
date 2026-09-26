# KanbanDoro API

API FastAPI e SQLite. O quadro e as estatísticas da extensão continuam no armazenamento local do navegador; **não existe sincronização do quadro com esta API**. A API atende autenticação própria e Connections Google com OAuth, renovação de tokens e consultas ou escritas somente quando a extensão solicitar. A chave de IA fica no navegador.

## Desenvolvimento

Na pasta `backend`, copie `.env.example` para `.env`, instale `pip install -e '.[dev]'` e rode `uvicorn app.main:app --reload`. Em desenvolvimento, as tabelas são criadas automaticamente. Para testar o mesmo caminho da VPS: `alembic -c alembic.ini upgrade head` e `pytest -q`.

## VPS com Docker Compose

Na VPS `vm-docker` analisada em setembro de 2026, as portas 80/443 são do Nginx e 8000, 8080, 8081, 8083 e outras atendem aplicações existentes. KanbanDoro usa **127.0.0.1:18080** e o projeto Compose isolado `kanbandoro`; o usuário `azureuser` precisa executar Docker por `sudo -n`. Não reaproveite o `newDeploy.sh` do CronFlow, que modifica seus serviços e diretórios.

Para implantar a API depois de configurar o `.env` remoto, rode na **raiz do repositório local**:

```bash
bash scripts/deploy-vps.sh azureuser@SEU_IP /caminho/da/vm-docker_key.pem
```

Na primeira execução o script envia somente o backend, cria `~/kanbandoro/backend/.env` de exemplo e interrompe para você preenchê-lo **na VPS**; na segunda, cria a imagem, salva backup prévio se já houver banco, sobe o serviço e confere `/health`. O script preserva o `.env` remoto, não envia o `.env` local e não altera Nginx ou os projetos existentes. Backups ficam em `~/kanbandoro-backups` fora do volume. Ele foi verificado sintaticamente; a execução na VPS requer acesso SSH e Docker.

1. Na VPS, copie o projeto e crie `backend/.env` com `APP_ENV=production`, um `JWT_SECRET` aleatório longo, `CORS_ORIGINS` restrito às origens da extensão e os parâmetros OAuth indicados em `.env.example`. O segredo OAuth e `GOOGLE_TOKEN_ENCRYPTION_KEY` ficam somente nesse arquivo, nunca na extensão ou no Compose.
2. Execute `docker compose up -d --build` na raiz. A inicialização aplica as migrações antes de subir um único processo de API. A porta padrão **18080** fica acessível apenas em `127.0.0.1`; configure `KANBANDORO_BIND_PORT` se essa porta já estiver ocupada.
3. Configure no seu proxy reverso existente um hostname HTTPS dedicado para `http://127.0.0.1:18080` e reconstrua a extensão com `KANBANDORO_API_URL=https://seu-host` e `KANBANDORO_GOOGLE_CLIENT_ID=...`. Cadastre `https://<extension-id>.chromiumapp.org/` como redirect de cada instalação Chrome, Brave ou Edge no cliente Google do tipo **Aplicativo da Web**. Instale os IDs correspondentes no `.env`.

A exposição pública exige revisar a autenticação e o cadastro de contas (`/auth/register`) antes de publicar: este serviço nasceu para uso pessoal e Connections ainda usam sessões próprias da extensão. Mantenha o binding local enquanto prepara essa revisão. Antes da primeira migração de uma base existente, copie o banco: a revisão `0001_baseline` cria tabelas que faltam e registra a versão sem apagar tabelas anteriores; revisões futuras usarão Alembic.

Para criar um backup consistente de um banco ativo, execute no container `python -m app.scripts.backup /caminho/de/backups` após montar um destino externo ao volume. O volume `kanbandoro_data` persiste `/data/kanbandoro.db`; faça cópias regulares **fora** do volume e teste a restauração em um volume separado. Não troque `GOOGLE_TOKEN_ENCRYPTION_KEY` sem planejar a reautenticação das Connections já gravadas.
