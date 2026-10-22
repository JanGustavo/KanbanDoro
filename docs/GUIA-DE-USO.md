# Guia de uso

[← Voltar ao README](../README.md)

Consulte cada etapa conforme precisar: planejar, focar, revisar e guardar seus dados.

- [Instalar a partir do código](#instalar-a-partir-do-código)
- [Backup e restauração](#backup-e-restauração)
- [Atualizar a extensão](#atualizar-a-extensão)
- [Recursos disponíveis e pendências](#recursos-disponíveis-e-pendências)
- [Aviso de prazo](#aviso-de-prazo)
- [Recorrência](#recorrência)
- [Lembretes](#lembretes)
- [Bloqueio de distrações](#bloqueio-de-distrações)
- [Materiais durante o foco](#materiais-durante-o-foco)
- [Plano para hoje](#plano-para-hoje)
- [Retomada e fechamento diário](#retomada-e-fechamento-diário)
- [Ações dos lembretes](#ações-dos-lembretes)
- [Primeira tarefa e modo estudo](#primeira-tarefa-e-modo-estudo)
- [Produto](#produto)
- [Entrada por voz](#entrada-por-voz)
- [Confirmações e abertura do quadro](#confirmações-e-abertura-do-quadro)
- [Bolha e indicador de foco](#bolha-e-indicador-de-foco)
- [Revisão semanal e gerenciamento de áreas](#revisão-semanal-e-gerenciamento-de-áreas)

## Instalar a partir do código

1. Execute `npm install` e `npm run build`.
2. No Chrome/Chromium, abra `chrome://extensions`, habilite o modo de desenvolvedor e carregue a pasta `dist` como extensão sem compactação.
3. Clique no ícone da extensão para abrir o quadro. Tarefas, rotinas, slices e sessões ficam em `chrome.storage.local` no próprio navegador.

## Backup e restauração

Para copiar o quadro entre perfis ou guardar uma cópia, vá a **Preferências → Dados → Exportar ZIP completo**. O ZIP inclui os dados validados e os arquivos de tarefas e etapas, com um manifesto de integridade SHA-256; limites de 100 arquivos e 128 MB (10 MB por arquivo). A prévia mostra arquivos e tamanho descompactado, e dados ausentes ou corrompidos impedem a restauração. Os arquivos importados recebem novos IDs, sem sobrescrever arquivos locais. Se a gravação do quadro falhar, os novos arquivos são removidos. O JSON de até 16 MB continua disponível para dados textuais, sem arquivos binários. O arquivo versionado inclui tarefas, slices, histórico, rotinas, áreas personalizadas e preferências de quadro, pausa e bloqueio. Ele não inclui chaves de IA, credenciais Google ou sessão de foco ativa. A importação valida o JSON ou ZIP e mostra quantidades antes de gravar. Antes de **Mesclar** ou **Substituir**, baixe uma cópia do quadro atual e confirme que o arquivo foi salvo; se o quadro mudar, baixe outra cópia. **Mesclar** preserva a tarefa local quando o ID já existe e descarta eventos importados associados a esse ID, pois podem pertencer a outra tarefa; reúne as datas de ocorrência das rotinas. **Substituir** também pede confirmação. Encerre o foco ou a pausa antes de importar; o quadro recarrega após salvar.

## Atualizar a extensão

Ao atualizar a extensão, recarregue também as abas que já estavam abertas. O botão **Mostrar bolha** tenta instalar o script na aba ativa, inclusive quando ela foi aberta antes da extensão. O navegador bloqueia scripts em páginas internas ou restritas. A instalação solicita acesso aos sites para exibir a bolha sobre eles.

## Recursos disponíveis e pendências

**Implementado neste marco:** quadro local editável, slices, registro de foco, rotinas semanais, filtro por dia/semana, arquivo e exclusão de tarefas, uma sessão por vez, duas extensões com teto combinado de 50%, tentativa falha, interrupção e pausa com confirmação. O badge indica foco ativo, pausa ativa e vencimento. A bolha aparece nos sites permitidos e o aviso sonoro usa uma página offscreen. A criação assistida com Groq ou Gemini consulta modelos reais e abre um modal revisável; reescrever a proposta reapresenta o modal animado. **Ainda pendente:** ligação das tarefas/sessões do quadro à API, ajuda contextual da IA, voz local em tempo real e sincronização. A revisão semanal local já oferece análise opcional de IA após prévia e confirmação. As Connections já consultam o backend; as tarefas e sessões do quadro ainda ficam locais.

## Aviso de prazo

O aviso automático de prazo usa notificações locais às 9h do dia previsto, uma vez por tarefa e data. Se o navegador estiver fechado, a extensão avisa ao abrir dentro das 24 horas seguintes; não acumula avisos antigos. Tarefas concluídas ou arquivadas não notificam. O aviso não muda a coluna da tarefa.

## Recorrência

Nos **Detalhes da tarefa → Recorrência e lembrete**, transforme uma tarefa existente em **Só na semana escolhida** ou **Toda semana (fixa)**, defina dias, data inicial e horário opcional e clique em **Salvar programação**. Fixa significa repetir continuamente. A conversão preserva a tarefa e seu histórico; salvar uma rotina atualiza os detalhes das próximas ocorrências. **Uma vez** encerra a repetição, mantendo as tarefas já criadas. Criação manual/assistida também oferece horário; tarefas únicas escolhem a data do lembrete.

## Lembretes

O lembrete usa o horário local do navegador e funciona com a aba do quadro fechada, inclusive para rotinas ainda sem ocorrência gerada. Clicar no aviso abre o quadro. Conclusão, arquivo ou exclusão da ocorrência silencia o aviso daquele dia. Se o navegador estiver fechado, avisa ao reabrir no mesmo dia; dias anteriores não acumulam avisos. O Chrome pode atrasar alarmes durante suspensão, e as notificações precisam estar habilitadas no sistema. O aviso de prazo às 9h continua separado do lembrete de execução. Os novos campos entram nos backups JSON e ZIP.

## Bloqueio de distrações

Em **Modo foco**, acima do quadro, o modo sem distrações fica desligado por padrão. Essencial bloqueia algumas redes e jogos; Intenso amplia a lista; Meu perfil permite importar uma das listas e editá-la. É possível liberar domínios necessários ao trabalho. O bloqueio só vale para a navegação principal enquanto o ciclo está em foco, nunca nas pausas: uma tela escura aparece por cinco segundos e depois tenta abrir uma nova guia (ou uma guia vazia se o navegador impedir a navegação). Fechar o navegador, terminar o ciclo ou desligar o perfil libera os sites. O bloqueio é uma ferramenta de apoio, não um controle de acesso impossível de desativar. A extensão usa regras temporárias `declarativeNetRequest` e não envia o histórico de navegação a nenhum servidor; recomendações de tema escuro não alteram a aparência dos sites.

## Materiais durante o foco

No ciclo atual, cada etapa oferece **Anexar / anotar**. Concluir uma etapa abre seus materiais imediatamente, com anotações, entrada por voz e imagens/arquivos locais. O destino aparece no cabeçalho; os arquivos continuam disponíveis nos detalhes da tarefa e no backup ZIP. A tarefa inteira também tem um atalho de materiais. Esses controles aparecem durante o foco e nos modais de decisão e conclusão, sem precisar procurar o card no quadro. Anexar não pausa nem encerra o cronômetro; os limites de 20 arquivos por tarefa/etapa e 10 MB por arquivo continuam valendo.

## Plano para hoje

Em **Hoje → Plano para hoje**, escolha tarefas da fila, organize a ordem e acompanhe minutos estimados pendentes e conclusões. Também é possível clicar em **Planejar hoje** no card. O plano inclui todas as áreas, persiste ao reabrir o quadro e entra no backup JSON/ZIP. **Montar ciclo com este plano** copia as tarefas pendentes para o construtor; ajuste os minutos reservados e confirme o início. Tarefas em atraso também podem compor o ciclo. Retirar do plano preserva a tarefa e seu histórico. Compromissos do dia anterior não são transferidos automaticamente: o painel sinaliza pendências anteriores para você escolher o que retomar.

## Retomada e fechamento diário

**Retomada e fechamento diário:** no foco ou nos materiais, abra **Onde parei e próximo passo** para guardar seu contexto. Interromper também salva uma referência de etapa. Sem ciclo ativo, o painel **Retomar de onde parou** oferece materiais e foco na próxima etapa pendente. Em **Hoje → Fechar o dia / revisar pendências**, escolha o destino de cada pendência; o fechamento mantém as tarefas originais e guarda um resumo local. Encerre o ciclo/pausa antes de fechar o dia.

## Ações dos lembretes

**Lembretes com ação:** o corpo do aviso abre a tarefa certa. Os botões permitem abrir para confirmar o foco ou adiar por dez minutos, sem substituir um ciclo ativo. Em rotinas, o destino aponta para a ocorrência correspondente. A entrega nativa e a presença de botões dependem do navegador/sistema.

## Primeira tarefa e modo estudo

**Primeira tarefa e modo estudo:** uma instalação vazia acompanha seu primeiro fluxo usando uma tarefa real, sem criar exemplos. Você pode dispensar o guia ou recomeçar em **Preferências → Quadro**. O modo estudo organiza matérias como áreas e tópicos como tarefas; define objetivo, data da prova e meta diária; acompanha os minutos focados e cria uma fila local de revisões. Ao revisar, tente recuperar o tópico de memória e avalie como foi: a próxima revisão se ajusta de amanhã até intervalos maiores. Progresso e lembranças entram nos backups. Veja os limites e o funcionamento em [docs/WORKFLOW_PROFILES.md](WORKFLOW_PROFILES.md).

## Produto

Ao abrir um quadro novo, **Ver tutorial** apresenta os controles principais sem criar dados de exemplo. Use **Mais → Ver tutorial** para repetir o percurso quando quiser. A lógica reutilizável e o contrato de armazenamento/eventos estão em [docs/TOUR.md](TOUR.md).

O quadro tem filtro por área e contraste próprio nas quatro colunas. **Preferências → Quadro** oferece metas orientativas de WIP (2, 5 ou 8 tarefas) e permite cadastrar áreas livres. A IA recebe apenas os nomes das áreas existentes, pode sugerir uma área nova na proposta e só a salva após você confirmar a criação da tarefa. Selecione tarefas de **A fazer** ou **Em andamento** para montar o próximo ciclo. No alto do quadro ficam filtro por área, **Modo foco** e rotinas; bolha, Connections e Preferências ficam agrupados no cabeçalho.

- Quadro: **A fazer**, **Em andamento**, **Em atraso** e **Concluído**. Prazo é opcional. Uma tarefa pode conter slices concluíveis.
- Ciclo de foco: marque tarefas em **A fazer** ou **Em andamento** para o próximo ciclo (as de A fazer são movidas ao iniciar), ordene e escolha os minutos reservados a cada uma (ex.: 30 + 15 + 45). Esses minutos não mudam a estimativa total da tarefa. Um só relógio credita o tempo à tarefa ativa; se ela terminar cedo, o restante passa à próxima. Concluir a última encerra o foco antecipadamente e registra apenas o tempo usado. Ciclos antigos de uma tarefa permanecem compatíveis. Ainda é possível iniciar um ciclo individual para a tarefa inteira ou slices selecionados; o tempo dos slices selecionados continua compartilhado.
- Decisão por tarefa: avisos discretos aos 5 e 2 minutos restantes aparecem por 10 segundos na página do quadro; ao acabar o tempo reservado, o relógio pausa e um modal pede **Concluí e avançar**, **Estender** ou **Abrir detalhes**. O tempo aguardando não é creditado. São permitidas duas extensões por tarefa, somadas até 50% da estimativa total dela. Em detalhes, **Não consegui terminar** registra tentativa falha e move somente a tarefa atual para **Em atraso**, avançando quando houver outra no ciclo. Prazo vencido aparece no card como aviso sem mover a tarefa. O descanso sempre depende de confirmação.
- Pausa rápida dentro do foco: escolha de 1 a 30 minutos para um intervalo imprevisto. O relógio da tarefa congela, o bloqueio de sites é suspenso e a extensão avisa quando o intervalo acabar. O foco só volta ao clicar em **Retomar foco**; o tempo parado não entra no histórico.
- Interrupção: evento separado da tentativa falha. O tempo já trabalhado permanece registrado; o usuário escolhe recomeçar ou adiar.
- Descanso: categoria livre ou sugestões de água, comida, detox e descanso; cronômetro e som ao finalizar; foco seguinte depende de confirmação. Pausa curta e longa são configuráveis; a duração longa é escolhida automaticamente após cada quarto ciclo concluído, mas a pausa ainda depende do botão de confirmação.
- WIP: limite configurável para **Em andamento** e, opcionalmente, **Em atraso**. A coluna e as estatísticas mostram quando foi ultrapassado, sem impedir mover tarefas. O cabeçalho mostra ciclos concluídos no dia; um ciclo com várias tarefas conta uma vez.
- Insights dos slices: na edição da tarefa, defina opcionalmente minutos por slice e clique em **Analisar distribuição dos slices**. Nome, tempo total e etapas da tarefa atual, além do perfil e objetivo configurados, são enviados à IA; a resposta curta nunca altera a tarefa sozinha.
- Criação: o botão manual e a proposta da IA abrem um modal com nome, descrição, tempo e opção **Uma vez**, **Só na semana escolhida** ou **Toda semana**. Para as duas últimas, defina data inicial e dias; a primeira termina no domingo da semana escolhida. Ao abrir o quadro em um dia programado, nasce uma tarefa independente. Reabrir o quadro ou apagar a tarefa daquele dia não cria outra ocorrência no mesmo dia. Não há geração retroativa para dias em que a extensão ficou fechada. O menu de programação mostra o calendário e oferece o mesmo modal de criação.
- Conclusão e arquivo: "Hoje" e "Esta semana" mostram as concluídas no período e todas as pendentes; "Arquivo" filtra por data de conclusão. Arquivar preserva histórico; apagar remove também os registros de foco daquela tarefa, após confirmação. Apagar uma ocorrência não apaga sua rotina.

## Entrada por voz

O botão **🎙 Entrada por voz** permite gravar até dois minutos na criação de tarefas, no nome ou na descrição de uma proposta/tarefa e nas anotações da tarefa ou de suas etapas. Nos formulários de tarefa, escolha o destino da transcrição; o padrão é **Nome / pedido da tarefa**. Permita o microfone no navegador, clique em **Parar gravação** e depois em **Transcrever**. O texto é acrescentado ao campo para revisão; nenhuma tarefa ou proposta é enviada automaticamente.

Esta primeira versão usa `whisper-large-v3-turbo` na Groq, com a chave Groq salva em **Preferências → IA**, mesmo quando outro provedor está selecionado para as propostas. A gravação não é em tempo real. O áudio só sai do navegador ao clicar em Transcrever, está sujeito às cotas da sua conta e não fica guardado pelo KanbanDoro nem entra no backup. Cancelar descarta o áudio local e interrompe a captura; após o envio, não desfaz o processamento já iniciado no provedor. Limite de 10 MB por gravação. Não há nova permissão no manifesto: a autorização do microfone é solicitada pelo navegador.

## Confirmações e abertura do quadro

As ações de exclusão, substituição de backup e envio de e-mail usam SweetAlert2 empacotado na extensão, com as cores da aplicação. A confirmação mostra a ação e suas consequências, começa com foco em Cancelar e permite sair com Escape. Os modais de tarefas, propostas e decisões do cronômetro mantêm seus fluxos próprios.

O botão **Abrir** da bolha e o ícone da extensão reutilizam uma aba do KanbanDoro já aberta, inclusive em outra janela e com filtros/âncoras na URL. A janela é trazida para frente. Cliques simultâneos são agrupados para criar uma única aba quando ainda não há quadro aberto.

## Bolha e indicador de foco

A opção **Mais → Ajustar bolha do cronômetro** abre opções de exibição (expandida, recolhida ou oculta) e posição (esquerda/direita). As escolhas ficam salvas para as próximas abas e ciclos. Sem ciclo ativo, o painel explica quando a bolha aparecerá. Na bolha recolhida, clique ou use Enter/Espaço para expandir. Na expandida, clique no relógio ou em **Abrir quadro** para voltar à aba existente.

O ícone da extensão usa um relógio e contorno vinho durante o foco, pausa em amarelo e alerta quando uma decisão é necessária. O texto FOCO/PAUSA não cobre mais a marca.

A publicação também pode ser automática: um commit na `main` que altera a versão em `package.json` dispara o workflow de release. Ele só cria a tag/release após validar versões, compilar com OAuth/API remotos, testar e empacotar apenas `dist/`. Commits sem mudança de versão não publicam. O fluxo `make release VERSION=...` por tag continua disponível.

## Revisão semanal e gerenciamento de áreas

Em **Estatísticas → Revisão semanal**, escolha a semana para ver conclusões, foco registrado, lista de tarefas paradas e histórico local. O comparativo usa a semana anterior; pendências são o estado atual, sem reconstrução fictícia do quadro passado. Planejado versus realizado usa estimativas e tempo de foco **total das tarefas concluídas** no período, separado do foco registrado só naquela semana. Tarefas sem data de conclusão ou sem tempo medido são identificadas e não entram nas respectivas métricas. Amostras menores que três são pequenas; a mediana por área orienta uma revisão de estimativa, sem score de produtividade nem alteração automática.

**Revisar semana com IA** mostra o JSON de agregados antes do envio. Somente ao confirmar são enviados totais, nomes das áreas e comparação de períodos ao provedor configurado. Não vão nomes/descrições das tarefas, notas, links, arquivos nem eventos individuais. A resposta JSON é validada e exibida como conselho; se os dados mudarem, a análise anterior fica oculta até nova solicitação. Nada é enviado automaticamente.

Em **Preferências → Quadro → Áreas**, a lista também inclui áreas inferidas das tarefas/rotinas. Remover uma área pede confirmação e retira sua classificação do catálogo, das tarefas (inclusive arquivadas) e das rotinas, preservando o conteúdo e o histórico; essas tarefas passam a **Sem categoria** nas estatísticas. Apagar uma tarefa não apaga automaticamente uma área usada em outros lugares.

Em **Modo foco → Meu perfil**, categorias podem ser ligadas/desligadas em conjunto, e a busca encontra sites ou categorias. Exceções continuam valendo para o domínio informado e seus subdomínios em qualquer perfil, sem liberar o domínio pai. Os controles em grupo preservam exceções e sites personalizados de outras categorias.
