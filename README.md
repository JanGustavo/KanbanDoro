# KanbanDoro

Extensão Manifest V3 que reúne Kanban, ciclos de foco vinculados a tarefas e assistência de IA. O projeto está na fase de esqueleto e validação do fluxo principal.

## Rodar o esqueleto

1. Execute `npm install` e `npm run build`.
2. No Chrome/Chromium, abra `chrome://extensions`, habilite o modo de desenvolvedor e carregue a pasta `dist` como extensão sem compactação.
3. Clique no ícone da extensão para abrir o quadro. Nesta primeira versão, tarefas, slices e sessões ficam em `chrome.storage.local` no próprio navegador.

**Implementado neste marco:** quadro local editável, slices, registro de foco, uma sessão por vez, dois pedidos de extensão com teto combinado de 50%, tentativa falha, interrupção e pausa com confirmação. O badge indica foco ativo ou ciclo vencido. **Ainda pendente:** servidor, IA, fala, som de pausa, bolha sobre sites, sincronização, alerta de prazo e relatórios. O protótipo não envia dados para fora do navegador.

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

Extensão em TypeScript/React, com quadro em página própria, badge no ícone e, posteriormente, bolha injetada nos sites permitidos. O timer deve armazenar timestamps de início e fim e recalcular o estado após suspensão do service worker ou reinício do navegador. Backend FastAPI e SQLite para conta, sincronização, histórico e adaptadores de provedores de IA. Sem credenciais embutidas no pacote da extensão.

A IA nunca muda a tarefa sem revisão: criação abre modal; ajuda comum responde e aponta riscos; resposta do tipo proposta entra na caixa de propostas, com aplicação após aceite. Durante foco ou descanso, propostas aguardam. Perguntas sobre uma tarefa recebem o JSON da tarefa; decisões podem receber histórico e estatísticas relevantes. O provedor padrão é configurável e a disponibilidade ou gratuidade de APIs externas não é presumida.

## Fases

1. **Base:** quadro, slices, persistência local e ciclos com histórico e recuperação.
2. **Extensão completa:** bolha opcional nos sites permitidos, badge, alertas e preferências de pausa.
3. **IA e servidor:** revisão antes de salvar, contratos estruturados validados, propostas e chaves por usuário.
4. **Após histórico real:** score transparente de eficiência e WIP, voz local em tempo real, relatórios, exportação e modos da comunidade.

Veja [docs/REQUISITOS.md](docs/REQUISITOS.md) para regras e decisões em aberto. Ideias novas dentro deste conceito podem substituir o desenho atual; registre a motivação e atualize requisitos antes da implementação.
