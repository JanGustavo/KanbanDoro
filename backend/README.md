# KanbanDoro API

API experimental em FastAPI e SQLite. Instale com `pip install -e '.[dev]'` nesta pasta e execute `uvicorn app.main:app --reload`. Configure `JWT_SECRET` no `.env` antes de expor a API; veja `.env.example`.

O quadro da extensão ainda usa armazenamento local. A API atende as Connections Google com troca OAuth, renovação de token, consultas sob demanda e endpoints de criação de eventos e tarefas e de envio de e-mail mediante requisição explícita da extensão. A IA produz apenas um rascunho editável no navegador; não chama endpoints de escrita. A API não sincroniza as tarefas locais nem chama um provedor de IA. Não coloque a chave de IA no cadastro: a chave fica no navegador.

Para OAuth, configure em `.env` as variáveis `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_EXTENSION_ID` (e `GOOGLE_EXTENSION_IDS` se instalar em outros navegadores com IDs diferentes) e `GOOGLE_TOKEN_ENCRYPTION_KEY`. O cliente Google deve ser do tipo **Aplicativo da Web** e aceitar cada `https://<id>.chromiumapp.org/`. Mantenha o segredo OAuth e a chave Fernet somente no servidor; use HTTPS ao expor o backend na VPS. A tabela `google_connections` nasce via `create_all` em banco novo; ao atualizar banco já existente, crie a tabela por migração controlada antes do deploy.
