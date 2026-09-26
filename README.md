<div align="center">
  <img src="./public/icon.svg" alt="KanbanDoro Logo" width="128" height="128" />
</div>

# KanbanDoro

Extensão Manifest V3 que reúne Kanban, ciclos de foco vinculados a tarefas e assistência de IA. Versão 0.2.0 em desenvolvimento.

## Rodar o esqueleto

1. Execute `npm install` e `npm run build`.
2. No Chrome/Chromium, abra `chrome://extensions`, habilite o modo de desenvolvedor e carregue a pasta `dist` como extensão sem compactação.
3. Clique no ícone da extensão para abrir o quadro. Tarefas, rotinas, slices e sessões ficam em `chrome.storage.local` no próprio navegador.

Ao atualizar a extensão, recarregue também as abas que já estavam abertas. O botão **Mostrar bolha** tenta instalar o script na aba ativa, inclusive quando ela foi aberta antes da extensão. O navegador bloqueia scripts em páginas internas ou restritas. A instalação solicita acesso aos sites para exibir a bolha sobre eles.

**Implementado neste marco:** quadro local editável, slices, registro de foco, rotinas semanais, filtro por dia/semana, arquivo e exclusão de tarefas, uma sessão por vez, duas extensões com teto combinado de 50%, tentativa falha, interrupção e pausa com confirmação. O badge indica foco ativo, pausa ativa e vencimento. A bolha aparece nos sites permitidos e o aviso sonoro usa uma página offscreen. A criação assistida com Groq consulta modelos reais e abre um modal revisável; reescrever a proposta reapresenta o modal animado. **Ainda pendente:** ligação das tarefas/sessões do quadro à API, ajuda contextual da IA, fala, sincronização, alerta automático de prazo e relatórios. As Connections já consultam o backend; as tarefas e sessões do quadro ainda ficam locais.

## Produto

- Quadro: **A fazer**, **Em andamento**, **Em atraso** e **Concluído**. Prazo é opcional. Uma tarefa pode conter slices concluíveis.
- Ciclo de foco: ligado à tarefa inteira ou a um conjunto de slices. Ao selecionar vários slices, o tempo é compartilhado, sem distribuição individual inventada.
- Encerramento: pede confirmação para iniciar o descanso ou continuar. Até duas extensões por ciclo, cuja soma não supera 50% da duração original. Ao escolher “Não consegui terminar”, registra tentativa falha e move a tarefa para “Em atraso”. Ao recomeçar o trabalho, ela volta para “Em andamento”, preservando o histórico.
- Interrupção: evento separado da tentativa falha. O tempo já trabalhado permanece registrado; o usuário escolhe recomeçar ou adiar.
- Descanso: categoria livre ou sugestões de água, comida, detox e descanso; cronômetro e som ao finalizar; foco seguinte depende de confirmação.
- WIP: cinco tarefas em andamento geram aviso orientativo, nunca bloqueio.
- Criação: o botão manual e a proposta da IA abrem um modal com nome, descrição, tempo e opção **Uma vez**, **Só na semana escolhida** ou **Toda semana**. Para as duas últimas, defina data inicial e dias; a primeira termina no domingo da semana escolhida. Ao abrir o quadro em um dia programado, nasce uma tarefa independente. Reabrir o quadro ou apagar a tarefa daquele dia não cria outra ocorrência no mesmo dia. Não há geração retroativa para dias em que a extensão ficou fechada. O menu de programação mostra o calendário e oferece o mesmo modal de criação.
- Conclusão e arquivo: "Hoje" e "Esta semana" mostram as concluídas no período e todas as pendentes; "Arquivo" filtra por data de conclusão. Arquivar preserva histórico; apagar remove também os registros de foco daquela tarefa, após confirmação. Apagar uma ocorrência não apaga sua rotina.

## Proposta visual

Base neutra escura; vinho para foco e amarelo queimado para Kanban. Card com nome, dificuldade, tempo estimado, prazo opcional e uma faixa inferior com os slices, riscados conforme a conclusão.

## Arquitetura pretendida

Extensão em TypeScript/React, com quadro em página própria, badge no ícone e bolha leve injetada nos sites permitidos. O timer deve armazenar timestamps de início e fim e recalcular o estado após suspensão do service worker ou reinício do navegador. Backend FastAPI e SQLite com autenticação e endpoints preliminares de tarefas e sessões; as Connections usam o backend para OAuth e leitura das APIs Google, mas as tarefas e sessões ainda não o utilizam. Ao integrar, migraremos os dados locais explicitamente para evitar perda ou duplicação. Sem segredos embutidos no pacote da extensão.

A IA nunca muda a tarefa sem revisão: criação abre modal; ajuda comum responde e aponta riscos; resposta do tipo proposta entra na caixa de propostas, com aplicação após aceite. Durante foco ou descanso, propostas aguardam. Perguntas sobre uma tarefa recebem o JSON da tarefa; decisões podem receber histórico e estatísticas relevantes. O provedor padrão é configurável e a disponibilidade ou gratuidade de APIs externas não é presumida.

**Teste de IA:** Groq é o provedor ativo nesta fase (diferente do Grok da xAI). Em Preferências → IA, selecione Groq, digite sua chave e clique em **Salvar chave e modelo**. Depois clique em **Atualizar modelos**: a extensão consulta `GET /openai/v1/models` e oferece apenas modelos de texto com saída estruturada. Escolha um modelo e salve novamente. Descreva uma tarefa no quadro, clique em **Propor com IA** e revise nome, descrição, tempo, dificuldade, slices e anexos. É possível editar ou pedir uma reescrita por comentário; só **Aceitar e criar tarefa** grava a proposta. Em Anexos, links HTTPS são consultados antes de abrir e só os verificados recentemente são salvos; a resposta HTTP não confirma que a vaga ou o conteúdo ainda existe. A chave fica no armazenamento local restrito da extensão, não entra no prompt nem é enviada ao backend KanbanDoro. O teste automatizado simula a API; para validar uma chamada real, use sua chave na extensão instalada.

## Connections: Gmail, Calendar e Tasks

A extensão consulta mensagens do Gmail (até 10), eventos do Google Calendar (até 50, intervalo de até 31 dias) e listas/tarefas pendentes do Google Tasks (até 100 por página consultada). Cada item escolhido abre **uma proposta editável** no KanbanDoro. O painel Connections também recebe um pedido escrito, pede à Groq uma proposta de evento, tarefa do Google Tasks ou e-mail, e abre campos editáveis para revisão antes de gravar. E-mails exigem uma confirmação adicional antes do envio. É possível preencher tudo manualmente. Não existe sincronização nos dois sentidos nem execução em segundo plano; nenhuma mensagem consultada é enviada à Groq automaticamente.

### Configuração local

1. No Google Cloud, habilite **Gmail API**, **Google Calendar API** e **Google Tasks API**. Configure a tela de consentimento OAuth e, no modo de testes, adicione sua conta como usuário de teste.
2. Obtenha o ID estável da extensão no navegador em `chrome://extensions` / `brave://extensions`. Crie um **cliente OAuth do tipo Aplicativo da Web** e cadastre como URI de redirecionamento autorizado `https://<ID-DA-EXTENSAO>.chromiumapp.org/`, exatamente como `chrome.identity.getRedirectURL()` mostra em Connections. Se o ID variar entre navegadores, cadastre todos os redirects no mesmo cliente Web e liste os demais IDs em `GOOGLE_EXTENSION_IDS`. O cliente anterior, do tipo Extensão do Chrome, não serve para esse fluxo.
3. Em `backend/`, copie `.env.example` para `.env`, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_EXTENSION_ID` e `GOOGLE_TOKEN_ENCRYPTION_KEY`. Gere a chave Fernet pelo comando do `.env.example`. Instale `python -m pip install -e '.[dev]'` e inicie `uvicorn app.main:app --host 127.0.0.1 --port 8000`.
4. Rode `npm run build:local` na raiz **ou dentro de `backend/`**. Esse comando lê somente `GOOGLE_CLIENT_ID` de `backend/.env`, configura `http://127.0.0.1:8000` como API e executa o build na raiz. Recarregue a pasta `dist` no navegador. `npm run build` sozinho não lê o `.env` e gera a extensão sem Connections. Para outros computadores, defina `KANBANDORO_API_URL` com uma origem HTTPS acessível à extensão; `http://127.0.0.1` só alcança um servidor no mesmo computador.

Para incluir Connections no ZIP da GitHub Release, cadastre `KANBANDORO_GOOGLE_CLIENT_ID` e `KANBANDORO_API_URL` como **variáveis do repositório** no GitHub antes de criar a tag; o segredo OAuth permanece apenas no `.env` do servidor. Sem essas variáveis a extensão é gerada sem Connections, mas segue utilizável para o quadro.

O build grava apenas o ID público OAuth e a URL da API em `dist/connections-config.json`. O `manifest.json` mantém `identity` e adiciona somente a origem do backend em `host_permissions`; **não** define `oauth2` porque `launchWebAuthFlow` usa o cliente Web e constrói a URL OAuth explicitamente. O `client_secret` fica exclusivamente no backend. A extensão gera `state` e PKCE, recebe o código por `chromiumapp.org` e o entrega ao backend para a troca. O backend guarda o refresh token criptografado no SQLite e devolve uma sessão opaca; a extensão só solicita os dados resumidos para a interface. Ao desconectar, o servidor tenta revogar o consentimento e apaga a sessão e os tokens locais. Para proteção efetiva do SQLite, mantenha a chave Fernet separada dos backups do banco e faça backup dessa chave para preservar conexões.

Os escopos solicitados juntos são `gmail.readonly`, `gmail.send`, `calendar.readonly`, `calendar.events` e `tasks`. A escrita requer nova autorização das conexões feitas antes dessa atualização: use **Atualizar permissões** no painel. Configure esses escopos na tela de consentimento do Google Cloud. O Google classifica `gmail.readonly` como restrito; para disponibilização pública, poderá exigir verificação OAuth. No modo de teste do Google, o refresh token pode expirar e exigir nova conexão. Defina uma conta de testes antes de testar com dados reais. Nenhum consentimento autoriza de antemão escopos futuros ainda não solicitados.

## Fases

1. **Base:** quadro, slices, persistência local e ciclos com histórico e recuperação.
2. **Extensão completa:** bolha opcional nos sites permitidos, badge, alertas e preferências de pausa.
3. **Integração:** migração local → servidor, ajuda contextual, contratos de IA para decisões e propostas com aprovação. O cadastro da API não recebe chaves de IA; a criação assistida usa somente a Groq configurada na extensão.
4. **Após histórico real:** score transparente de eficiência e WIP, voz local em tempo real, relatórios, exportação e modos da comunidade.

Veja [docs/REQUISITOS.md](docs/REQUISITOS.md) para regras e decisões em aberto. Ideias novas dentro deste conceito podem substituir o desenho atual; registre a motivação e atualize requisitos antes da implementação.

## API experimental

Em `backend/`, execute `python -m pip install -e ".[dev]"`, configure `.env` a partir de `.env.example` e inicie com `uvicorn app.main:app --reload --host 127.0.0.1`. A documentação interativa está em `/docs`. Use `POST /auth/register`, `POST /auth/login` e o Bearer token nas demais rotas. O servidor mantém uma sessão ativa por conta e decide as transições pelo próprio relógio; o cliente não altera diretamente tempo, fase, pontuação ou histórico. `GET /sessions/active` retoma o estado. Os horários de sessão usam milissegundos desde a época Unix; campos de criação/histórico usam segundos.

A API ainda cria tabelas com `create_all`; alterações futuras de esquema exigirão migrações antes de servir dados de produção. A chave informada na extensão fica em `chrome.storage.local` com acesso restrito aos contextos da extensão; a tela da bolha recebe somente estado do timer.

## Contexto para IA

O histórico ainda não é enviado ao modelo. Quando essa etapa for ligada, o contexto deve ser montado para cada decisão: tarefa atual completa, resumo recente por tipo e dificuldade, estimativa versus tempo realizado e algumas ocorrências comparáveis. Um limite por quantidade de eventos e tamanho do JSON evita enviar toda a base a cada pergunta. O histórico estruturado pode ficar no SQLite existente; migrar para MongoDB não é necessário para montar esse recorte.

## Publicar uma versão 0.x

Atualize `package.json`, `package-lock.json` e `public/manifest.json` para a mesma versão; faça commit na `main` e sincronize com o remoto. Execute `make release VERSION=0.2.0`. O comando verifica versões, árvore limpa, build e testes, e envia a tag `v0.2.0`. A GitHub Action da tag recompila e publica a Release com o ZIP da pasta `dist`. Não rode o comando novamente para uma tag já publicada; versões 0.x são marcadas como pré-lançamento. Criar uma tag é uma ação de publicação, feita apenas ao executar explicitamente o comando.

### VPS e estatísticas

O backend agora tem `compose.yaml` e `backend/Dockerfile` com SQLite em volume persistente, migração Alembic e porta ligada a `127.0.0.1:18080`. Consulte [backend/README.md](backend/README.md) antes de configurar a VPS. O painel **Estatísticas** calcula foco semanal, estimativas e resultados a partir das tarefas locais: você pode atribuir uma habilidade ou área na criação ou nos detalhes; tarefas antigas aparecem em “Sem categoria”. Ainda não existe sincronização de tarefas com o backend.
