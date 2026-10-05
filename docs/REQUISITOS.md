# Requisitos e decisões — versão inicial

Este documento é vivo. Uma solução melhor pode substituir a regra anterior desde que preserve o objetivo Kanban + foco + assistência, explique a mudança e mantenha os dados existentes migráveis.

## Tarefas e quadro

- Colunas: A fazer, Em andamento, Em atraso, Concluído.
- O prazo é opcional. Prazo vencido aparece como aviso calculado no card e não altera a coluna. “Não consegui terminar” registra tentativa falha e move a tarefa para “Em atraso”.
- Cada tarefa tem nome, descrição, dificuldade, estimativa, prazo opcional e slices concluíveis. A dificuldade proposta pela IA e a estimativa são revisáveis pelo usuário.
- Uma tarefa em atraso volta a Em andamento ao iniciar novo ciclo. O número de tentativas falhas não zera.
- Ao ultrapassar cinco tarefas em andamento, avisar sobre WIP e permitir continuar; sugestão da IA é opcional, sempre justificável.
- O quadro oferece Hoje, Esta semana, Todas e Arquivo. Registrar data de conclusão e permitir arquivar/restaurar sem perder tempo e histórico. Apagar requer confirmação e exclui também eventos de foco daquela tarefa; não pode apagar a sessão em uso.
- Preferências → Dados oferece exportação local em JSON versionado e importação com validação e prévia. O arquivo inclui tarefas, histórico, rotinas e preferências, mas exclui chaves de IA, tokens Google e sessão ativa. Importar exige encerrar a sessão, baixar e confirmar uma cópia atual do quadro antes de gravar. Mesclar por ID mantém a tarefa local e descarta eventos importados ligados a IDs de tarefa colidentes; substituir exige confirmação adicional.
- O modal manual e o de proposta permitem tarefa única, dias selecionados somente na semana da data inicial ou recorrência nos mesmos dias de todas as semanas. Ao abrir o quadro em um dia agendado, gerar uma ocorrência independente no máximo uma vez naquele dia; excluir uma ocorrência não a recria. Dias com a extensão fechada não são preenchidos retroativamente. Excluir a programação preserva ocorrências passadas.


## Plano para hoje e materiais no foco

- Motivação: filtrar conclusões do dia não define prioridades; anexar resultados aos slices exigia sair do foco e procurar a tarefa e a etapa nos detalhes.
- Hoje inclui um plano explícito, separado da fila geral do quadro. Cada tarefa guarda opcionalmente `plannedFor` e `plannedOrder`, compatíveis com dados antigos e preservados no backup. Não muda prazo, coluna, estimativa ou histórico.
- Escolher tarefas pendentes, inclusive atrasadas, ordenar e retirar do plano; mostrar soma de estimativas das pendências e quantidade concluída. O plano reúne todas as áreas. Arquivadas ficam fora do plano. Dia anterior permanece registrado na tarefa até novo planejamento; não transfere automaticamente as pendências.
- Preparar o ciclo copia as tarefas pendentes na ordem do plano e suas estimativas para o construtor existente, sem iniciar foco. O usuário ajusta os minutos reservados; continua valendo o teto de 480 minutos por ciclo e uma sessão por vez. Atrasadas podem compor ciclos e passam a Em andamento ao iniciar.
- No foco, cada slice oferece conclusão e acesso direto aos seus materiais; marcar concluído abre o destino daquela etapa sem abrir a edição da tarefa. Materiais da tarefa inteira também são acessíveis. Os controles ficam disponíveis nos modais de decisão e ciclo concluído.
- Anexos usam o armazenamento local existente e aparecem nos detalhes e no backup ZIP; anotações entram no JSON. O cabeçalho identifica o destino. Adicionar/remover arquivos usa o conjunto atual de arquivos, preservando adições realizadas enquanto outro painel estava aberto. Upload informa progresso e resultado. Anexar ou escrever não altera a sessão nem pausa automaticamente o foco.

## Recorrência e lembretes

- Motivação: rotinas já podiam ser criadas, mas tarefas existentes não podiam receber programação. A edição agora permite Uma vez, Só na semana escolhida e Toda semana (fixa). Fixa significa recorrência contínua nos dias escolhidos.
- Converter uma tarefa preserva ID, slices, coluna, tempo e histórico. Se hoje for um dia programado, ela representa a ocorrência de hoje. Alterar uma rotina mantém seu ID e as datas já geradas; salvar copia os detalhes atuais para próximas ocorrências, sem modificar outras ocorrências existentes. Uma vez encerra a rotina e mantém as tarefas geradas.
- Criação e edição permitem horário opcional de lembrete; tarefas únicas também escolhem a data. O calendário e os cards mostram o horário. O backup JSON/ZIP preserva e valida os novos campos, sem exigir migração de dados antigos.
- O service worker usa alarmes e notificações locais, mesmo com a aba do quadro fechada. As rotinas notificam sem depender de gerar uma tarefa pela interface; clicar abre/reutiliza o quadro, que gera a ocorrência do dia. Não inicia foco nem muda a coluna automaticamente.
- Um aviso por fonte, data e horário; concluir, arquivar ou apagar a ocorrência a silencia. Editar o horário substitui o próximo aviso. Não existe preenchimento retroativo: ao reabrir o navegador, apenas lembretes do dia atual podem aparecer. Horário local do navegador; sistema suspenso, navegador fechado ou notificações desativadas podem impedir entrega pontual.
- Avisos de prazo às 9h permanecem independentes dos lembretes de execução, pois prazo e horário planejado têm significados diferentes.

## Sessões

- Um ciclo escolhe tarefa inteira ou subconjunto de slices. Tempo de seleção múltipla permanece compartilhado. Concluir o escopo de slices marca apenas os slices selecionados; a tarefa só vai para Concluído se todos os slices estiverem completos. Concluir a tarefa inteira move o card para Concluído.
- Estimativa da tarefa é esforço total; minutos reservados para ela em um ciclo não alteram essa estimativa. Um ciclo aceita várias tarefas em ordem, com uma sessão ativa. O tempo restante ao concluir uma tarefa antes do prazo passa para a próxima; concluir a última encerra o foco e permite escolher uma pausa, registrando apenas os minutos trabalhados.
- Persistir timestamps, prazo da tarefa atual, duração original, extensão acumulada, status e histórico de eventos. Evitar usar intervalos de tela como relógio de verdade.
- Avisar aos 5 e 2 minutos restantes da tarefa, por 10 segundos, sem interromper. Ao zerar o tempo reservado à tarefa, pausar o relógio e exigir uma decisão no modal. O tempo esperando não é contabilizado.
- Cada tarefa admite no máximo duas extensões; a soma é limitada a 50% da estimativa total da própria tarefa. Ao esgotar as extensões, o modal oferece concluir/avançar e abrir detalhes; registrar “Não consegui terminar” fica nos detalhes, mesmo antes de zerar. A tentativa falha move apenas essa tarefa para “Em atraso” e avança; se for a última, encerra o foco sem contar ciclo concluído. Descanso não começa sozinho.
- Pausa tem categoria e duração configuráveis; aviso sonoro ao fim e confirmação para o próximo foco.
- Ocultar ou recolher a bolha não pausa o tempo. Ícone informa atividade. Há uma sessão ativa e um cronômetro, mesmo quando o ciclo contém várias tarefas.
- Interrupção externa tem evento separado de falha. Tempo já trabalhado conta; recomeçar e adiar são decisões do usuário.
- Ao reabrir o navegador, reconciliar timestamps e apresentar sessão em andamento ou decisão pendente.

## IA

- Transcrição aparece enquanto se fala; Enter encerra captura deixando texto editável; Shift+Enter envia diretamente; Enter novamente ou botão envia; Esc cancela.
- Criar tarefa por IA abre modal revisável, com tempo em destaque. Usuário aceita, altera manualmente ou contrapõe via comentário. Nunca mostrar JSON cru.
- Dúvida na tarefa: contexto estruturado completo daquela tarefa; avaliação decisória: acrescentar histórico e estatísticas pertinentes.
- Assistência comum responde, sugere e identifica erros graves. Alterações estruturadas exigem modo proposta e confirmação humana.
- Proposta pode ser solicitada ou sugerida pela IA, com campo explícito no contrato. Som e animação ao abrir; durante foco e descanso, armazenar na caixa para revisão posterior.
- Reescrever uma proposta mostra novamente o modal com animação. Para personalizar por histórico, selecionar somente resumo e exemplos relevantes; não enviar todo o histórico a cada requisição. SQLite já armazena eventos estruturados.
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

## Marcos de aceitação

- Criar e editar tarefa/slices; mover entre colunas; prazo opcional.
- Rodar foco; recolher interface; recarregar/fechar e recuperar tempo correto.
- Extensões respeitam contagem e limite total; tentativas falhas e interrupções registradas separadamente.
- Preferências de pausa customizáveis e badge indicador de status de pausa.
- Bolha opcional e não intrusiva exibida nos sites, sincronizada com o estado local.
- Notificação sonora ao fim do foco/pausa.
- IA só altera dados após revisão; saída inválida não corrompe tarefa.
