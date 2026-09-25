<div align="center">
  <img src="./public/icon.svg" alt="KanbanDoro Logo" width="128" height="128" />
</div>

# KanbanDoro

Extensão Manifest V3 que reúne Kanban, ciclos de foco vinculados a tarefas e assistência de IA. O projeto está na fase de esqueleto e validação do fluxo principal.

## Rodar o esqueleto

1. Execute `npm install` e `npm run build`.
2. No Chrome/Chromium, abra `chrome://extensions`, habilite o modo de desenvolvedor e carregue a pasta `dist` como extensão sem compactação.
3. Clique no ícone da extensão para abrir o quadro. Nesta primeira versão, tarefas, slices e sessões ficam em `chrome.storage.local` no próprio navegador.

Ao atualizar a extensão, recarregue também as abas que já estavam abertas. O botão **Mostrar bolha** tenta instalar o script na aba ativa, inclusive quando ela foi aberta antes da extensão. O navegador bloqueia scripts em páginas internas ou restritas. A instalação solicita acesso aos sites para exibir a bolha sobre eles.

**Implementado neste marco:** quadro local editável, slices, registro de foco, uma sessão por vez, dois pedidos de extensão com teto combinado de 50%, tentativa falha, interrupção e pausa com confirmação. O badge indica foco ativo, pausa e ciclo/pausa vencido. Preferências de pausa são editáveis no cabeçalho. Bolha flutuante nos sites permitidos e notificação do sistema ao fim do timer implementadas. O som depende da configuração de notificações do navegador e do sistema. **Ainda pendente:** ligação do quadro à API, IA, fala, sincronização, alerta automático de prazo e relatórios. O quadro ainda não envia dados para a API.

## Produto

- Quadro: **A fazer**, **Em andamento**, **Em atraso** e **Concluído**. Prazo é opcional. Uma tarefa pode conter slices concluíveis.
- Ciclo de foco: ligado à tarefa inteira ou a um conjunto de slices. Ao selecionar vários slices, o tempo é compartilhado, sem distribuição individual inventada.
- Encerramento: pede confirmação para iniciar o descanso ou continuar. Até duas extensões por ciclo, cuja soma não supera 50% da duração original. Ao escolher “Não consegui terminar”, registra tentativa falha e move a tarefa para “Em atraso”. Ao recomeçar o trabalho, ela volta para “Em andamento”, preservando o histórico.
- Interrupção: evento separado da tentativa falha. O tempo já trabalhado permanece registrado; o usuário escolhe recomeçar ou adiar.
- Descanso: categoria livre ou sugestões de água, comida, detox e descanso; cronômetro e som ao finalizar; foco seguinte depende de confirmação.
- WIP: cinco tarefas em andamento geram aviso orientativo, nunca bloqueio.

## Proposta visual

Base neutra escura; vinho para foco e amarelo queimado para Kanban. Card com nome, dificuldade, tempo estimado, prazo opcional e uma faixa inferior com os slices, riscados conforme a conclusão.

## Arquitetura pretendida

Extensão em TypeScript/React, com quadro em página própria, badge no ícone e bolha leve injetada nos sites permitidos. O timer deve armazenar timestamps de início e fim e recalcular o estado após suspensão do service worker ou reinício do navegador. Backend FastAPI e SQLite com autenticação e endpoints preliminares de tarefas e sessões; a extensão ainda não o utiliza. Ao integrar, migraremos os dados locais explicitamente para evitar perda ou duplicação. Sem credenciais embutidas no pacote da extensão.

A IA nunca muda a tarefa sem revisão: criação abre modal; ajuda comum responde e aponta riscos; resposta do tipo proposta entra na caixa de propostas, com aplicação após aceite. Durante foco ou descanso, propostas aguardam. Perguntas sobre uma tarefa recebem o JSON da tarefa; decisões podem receber histórico e estatísticas relevantes. O provedor padrão é configurável e a disponibilidade ou gratuidade de APIs externas não é presumida.

**Teste de IA:** a tela de preferências apenas guarda provedor, modelo e chave no navegador. Ainda não há chamada ao Grok, criação automática de tarefas ou proposta por IA. Selecionar `xAI (Grok)` e salvar a chave não inicia o assistente; a configuração ganhará efeito quando o adaptador e a revisão de propostas forem implementados.

## Fases

1. **Base:** quadro, slices, persistência local e ciclos com histórico e recuperação.
2. **Extensão completa:** bolha opcional nos sites permitidos, badge, alertas e preferências de pausa.
3. **Integração:** migração local → servidor, revisão de tarefas antes de salvar, contratos de IA estruturados e propostas com aprovação. O cadastro da API não recebe chaves de IA; a configuração de provedor na extensão é apenas uma preparação, sem chamadas externas.
4. **Após histórico real:** score transparente de eficiência e WIP, voz local em tempo real, relatórios, exportação e modos da comunidade.

Veja [docs/REQUISITOS.md](docs/REQUISITOS.md) para regras e decisões em aberto. Ideias novas dentro deste conceito podem substituir o desenho atual; registre a motivação e atualize requisitos antes da implementação.

## API experimental

Em `backend/`, execute `python -m pip install -e ".[dev]"`, configure `.env` a partir de `.env.example` e inicie com `uvicorn app.main:app --reload --host 127.0.0.1`. A documentação interativa está em `/docs`. Use `POST /auth/register`, `POST /auth/login` e o Bearer token nas demais rotas. O servidor mantém uma sessão ativa por conta e decide as transições pelo próprio relógio; o cliente não altera diretamente tempo, fase, pontuação ou histórico. `GET /sessions/active` retoma o estado. Os horários de sessão usam milissegundos desde a época Unix; campos de criação/histórico usam segundos.

A API ainda cria tabelas com `create_all`; alterações futuras de esquema exigirão migrações antes de servir dados de produção. A chave informada na extensão fica em `chrome.storage.local` com acesso restrito aos contextos da extensão; a tela da bolha recebe somente estado do timer.
