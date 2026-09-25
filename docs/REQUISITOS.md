# Requisitos e decisões — versão inicial

Este documento é vivo. Uma solução melhor pode substituir a regra anterior desde que preserve o objetivo Kanban + foco + assistência, explique a mudança e mantenha os dados existentes migráveis.

## Tarefas e quadro

- Colunas: A fazer, Em andamento, Em atraso, Concluído.
- O prazo é opcional. Prazo vencido ou “Não consegui terminar” pode levar a “Em atraso”; o motivo precisa ser distinguível no histórico.
- Cada tarefa tem nome, descrição, dificuldade, estimativa, prazo opcional e slices concluíveis. A dificuldade proposta pela IA e a estimativa são revisáveis pelo usuário.
- Uma tarefa em atraso volta a Em andamento ao iniciar novo ciclo. O número de tentativas falhas não zera.
- Ao ultrapassar cinco tarefas em andamento, avisar sobre WIP e permitir continuar; sugestão da IA é opcional, sempre justificável.

## Sessões

- Um ciclo escolhe tarefa inteira ou subconjunto de slices. Tempo de seleção múltipla permanece compartilhado.
- Persistir timestamps, duração original, extensão acumulada, status e histórico de eventos. Evitar usar intervalos de tela como relógio de verdade.
- Ao zerar: pedir decisão; descanso não começa sozinho. Permitir até duas extensões, total máximo de metade da duração original.
- Ao esgotar as extensões: permitir registrar falha de conclusão e abrir ciclo novo mais tarde.
- Pausa tem categoria e duração configuráveis; aviso sonoro ao fim e confirmação para o próximo foco.
- Ocultar ou recolher a bolha não pausa o tempo. Ícone informa atividade. Múltiplas tarefas podem ter bolhas empilhadas; é preciso definir se seus ciclos podem contar simultaneamente.
- Interrupção externa tem evento separado de falha. Tempo já trabalhado conta; recomeçar e adiar são decisões do usuário.
- Ao reabrir o navegador, reconciliar timestamps e apresentar sessão em andamento ou decisão pendente.

## IA

- Transcrição aparece enquanto se fala; Enter encerra captura deixando texto editável; Shift+Enter envia diretamente; Enter novamente ou botão envia; Esc cancela.
- Criar tarefa por IA abre modal revisável, com tempo em destaque. Usuário aceita, altera manualmente ou contrapõe via comentário. Nunca mostrar JSON cru.
- Dúvida na tarefa: contexto estruturado completo daquela tarefa; avaliação decisória: acrescentar histórico e estatísticas pertinentes.
- Assistência comum responde, sugere e identifica erros graves. Alterações estruturadas exigem modo proposta e confirmação humana.
- Proposta pode ser solicitada ou sugerida pela IA, com campo explícito no contrato. Som e animação ao abrir; durante foco e descanso, armazenar na caixa para revisão posterior.
- Score e eficiência só após volume mínimo de eventos; mostrar dados, recorte e justificativa, sem apresentar estimativas incertas como fatos.

## UX

- Página do quadro; bolha de sessão opcional nos sites onde a extensão possa atuar; visível, recolhida ou oculta.
- Card mostra nome, dificuldade, estimativa e prazo, com faixa de slices riscados conforme finalizados.
- Paleta inicial: superfície neutra escura, vinho para foco e amarelo queimado para quadro. Contraste e estado devem ser claros além da cor.

## Em aberto para a próxima rodada

1. Ciclos simultâneos por tarefa versus uma única sessão de foco ativa por conta.
2. Critério de término automático de tarefa quando todos os slices estiverem concluídos.
3. Regra de sessão ao ficar offline e sincronização entre dispositivos.
4. Local de armazenamento e escopo de chaves de provedores informadas pelo usuário.
5. Suporte inicial a navegadores Chromium e compatibilidade posterior.
6. Semântica exata da duração estimada: tarefa inteira, ciclo ou ambas.

## Marcos de aceitação

- Criar e editar tarefa/slices; mover entre colunas; prazo opcional.
- Rodar foco; recolher interface; recarregar/fechar e recuperar tempo correto.
- Extensões respeitam contagem e limite total; tentativas falhas e interrupções registradas separadamente.
- Preferências de pausa customizáveis e badge indicador de status de pausa.
- Bolha opcional e não intrusiva exibida nos sites, sincronizada com o estado local.
- Notificação sonora ao fim do foco/pausa.
- IA só altera dados após revisão; saída inválida não corrompe tarefa.
