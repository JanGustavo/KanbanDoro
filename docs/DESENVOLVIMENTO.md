# Desenvolvimento e publicação

[← Voltar ao README](../README.md)

Arquitetura, validação, API experimental e publicação.

- [Validar o projeto](#validar-o-projeto)
- [Proposta visual](#proposta-visual)
- [Arquitetura](#arquitetura)
- [Fases](#fases)
- [API experimental](#api-experimental)
- [Publicar uma versão 0.x](#publicar-uma-versão-0x)
- [VPS e estatísticas](#vps-e-estatísticas)
- [Página de apresentação](#página-de-apresentação)

## Validar o projeto

Para validar alterações localmente, execute `npm ci` e `npm run validate` (ou `make validate`): compila, faz lint e executa os testes. `npm test` também funciona sem build anterior: prepara o script de conteúdo em `.test-dist` e testa o service worker diretamente em `public/background.js`. Os testes não modificam a pasta `dist` nem sua configuração OAuth. Sem variáveis de Connections, a validação compila com Connections desabilitadas; para usar a extensão com o servidor público, rode `npm run build:remote` após validar. PRs recebem a mesma validação automática no GitHub.

## Proposta visual

Base neutra escura; vinho para foco e amarelo queimado para Kanban. Card com nome, dificuldade, tempo estimado, prazo opcional e uma faixa inferior com os slices, riscados conforme a conclusão.

## Arquitetura

Extensão em TypeScript/React, com quadro em página própria, badge no ícone e bolha leve injetada nos sites permitidos. O timer deve armazenar timestamps de início e fim e recalcular o estado após suspensão do service worker ou reinício do navegador. Backend FastAPI e SQLite com autenticação e endpoints preliminares de tarefas e sessões; as Connections usam o backend para OAuth e leitura das APIs Google, mas as tarefas e sessões ainda não o utilizam. Ao integrar, migraremos os dados locais explicitamente para evitar perda ou duplicação. Sem segredos embutidos no pacote da extensão.

## Fases

1. **Base:** quadro, slices, persistência local e ciclos com histórico e recuperação.
2. **Extensão completa:** bolha opcional nos sites permitidos, badge, alertas e preferências de pausa.
3. **Integração:** migração local → servidor, ajuda contextual, contratos de IA para decisões e propostas com aprovação. O cadastro da API não recebe chaves de IA; a criação assistida usa Groq ou Gemini configurado na extensão.
4. **Após histórico real:** score transparente de eficiência e WIP, voz local em tempo real, relatórios, formatos de exportação adicionais e modos da comunidade.

As lacunas priorizadas para fechar a 1.0 estão em [docs/V1_READINESS.md](V1_READINESS.md).

Veja [docs/REQUISITOS.md](REQUISITOS.md) para regras e decisões em aberto. Ideias novas dentro deste conceito podem substituir o desenho atual; registre a motivação e atualize requisitos antes da implementação.

## API experimental

Em `backend/`, execute `python -m pip install -e ".[dev]"`, configure `.env` a partir de `.env.example` e inicie com `uvicorn app.main:app --reload --host 127.0.0.1`. A documentação interativa está em `/docs`. Use `POST /auth/register`, `POST /auth/login` e o Bearer token nas demais rotas. O servidor mantém uma sessão ativa por conta e decide as transições pelo próprio relógio; o cliente não altera diretamente tempo, fase, pontuação ou histórico. `GET /sessions/active` retoma o estado. Os horários de sessão usam milissegundos desde a época Unix; campos de criação/histórico usam segundos.

A API ainda cria tabelas com `create_all`; alterações futuras de esquema exigirão migrações antes de servir dados de produção. A chave informada na extensão fica em `chrome.storage.local` com acesso restrito aos contextos da extensão; a tela da bolha recebe somente estado do timer.

Em **Preferências → IA**, Groq e Gemini têm campos de chave separados. Salve a chave do provedor, consulte os modelos Flash disponibilizados na sua conta Gemini ou os modelos compatíveis Groq e salve o modelo escolhido. Propostas de tarefas, propostas das Connections e insights de slices usam o mesmo JSON validado; a implementação da API Gemini usa `generateContent` e a chave no cabeçalho `x-goog-api-key`. A disponibilidade e as cotas do nível gratuito variam conforme a conta e o modelo. Nenhuma chave vai para o prompt.

## Publicar uma versão 0.x

Depois de validar o PR e autorizar a publicação, atualize `package.json`, `package-lock.json` e `public/manifest.json` para a mesma versão. Um commit na `main` com mudança de versão dispara a publicação automática; por isso, PRs de implementação mantêm a versão atual até aprovação. O workflow valida, compila com OAuth/API remotos, testa e publica o ZIP contendo somente `dist/`. O comando `make release VERSION=...` continua disponível para o fluxo por tag, mas não deve ser repetido para uma tag já publicada. Versões 0.x são pré-lançamentos.

## VPS e estatísticas

O backend agora tem `compose.yaml` e `backend/Dockerfile` com SQLite em volume persistente, migração Alembic e porta ligada a `127.0.0.1:18080`. Consulte [backend/README.md](../backend/README.md) antes de configurar a VPS. O painel **Estatísticas** mostra foco da semana, dias ativos, tarefas em andamento e atrasos, além de estimativas e resultados a partir das tarefas locais: você pode atribuir uma habilidade ou área na criação ou nos detalhes; tarefas antigas aparecem em “Sem categoria”. Ainda não existe sincronização de tarefas com o backend.

## Página de apresentação

A landing page estática mora em [`site/`](../site/), com layout adaptável e a identidade vinho/amarelo da extensão. O endereço previsto é `kanbandoro.jangustavo.me`; um modelo de Nginx serve a página nesse subdomínio e expõe apenas as rotas Google em `api.kanbandoro.jangustavo.me`. Para os registros DNS e a publicação HTTPS, siga [`site/README.md`](../site/README.md).
