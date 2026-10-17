# Fechamento da versão 1.0

Avaliação do código em 05/10/2026. Este documento registra prioridades propostas; não significa que a 1.0 foi publicada ou que os itens abaixo foram implementados.

A promessa central é ajudar o usuário a escolher o próximo passo, reservar tempo para executá-lo e aprender com o resultado. A utilidade diária vem de reduzir decisões e recuperar compromissos esquecidos. Recorrência e lembretes apoiam essa promessa; aumentar o número de recursos por si só não prova seu valor.

## Entregue nesta alteração

- Plano para hoje com ordem persistente, estimativas pendentes e passagem revisável para o construtor de ciclo.
- Anotações e anexos diretamente nos slices do foco, com abertura automática ao concluir a etapa e acesso nos modais de decisão/conclusão.
- Transformar tarefas existentes em rotinas finitas ou fixas pelos detalhes; alterar dias e horário e interromper a repetição.
- Lembretes de tarefas únicas e rotinas no service worker, com quadro fechado, abertura do quadro por clique e supressão de avisos de ocorrências concluídas/arquivadas/apagadas.
- Preservação de histórico na conversão, prevenção de duplicação no mesmo dia e backup compatível com os novos campos.
- Build, lint e testes automatizados. Anexo de imagem, anotação de etapa concluída, troca de etapa e planejamento foram conferidos em prévia com dados descartáveis. A entrega visual de notificações pelo navegador/sistema ainda exige teste com a extensão instalada.

## Atualização em 16/10/2026

Implementados nesta rodada: ponto de retomada com contexto e materiais; fechamento diário com decisão por pendência; lembrete com destino direto e adiamento; primeiro uso com tarefa real. O modo Estudo acompanha meta diária, prova, foco e revisões por recuperação ativa, com agenda adaptativa salva em backup. O escopo e os limites estão em [WORKFLOW_PROFILES.md](WORKFLOW_PROFILES.md).

O módulo atual também fica visível na tela inicial. Um clique abre as opções Geral e Estudo; a troca preserva tarefas e preferências e confirma o perfil ativado.

Os itens de lembrete e fechamento abaixo registram a motivação inicial; suas entregas básicas já foram implementadas. A bateria inclui agora testes para o cálculo das revisões do modo Estudo. Ainda falta conferir notificações na extensão instalada, validar a restauração no ambiente de uso e observar se as pessoas conseguem completar o fluxo diário sem ajuda. A programação pode ser editada pelos detalhes da tarefa; o painel semanal ainda não oferece edição direta nem prévia da próxima ocorrência.

## Critérios do modo Estudo para a 1.0

- Em **Preferências → Quadro**, a pessoa define objetivo, prova e minutos diários; matérias são áreas, tópicos são tarefas e etapas dividem tópicos.
- A tela de hoje mostra o progresso da meta e o tempo focado por matéria. Só sessões iniciadas no perfil Estudo entram na meta.
- Concluir um bloco cria a primeira revisão do tópico para o dia seguinte. A fila pede recuperação ativa, oferece um bloco de até 25 minutos e agenda a próxima revisão conforme a avaliação.
- Revisar uma tarefa concluída preserva seu estado no quadro. Excluir e desfazer uma tarefa preserva ou remove junto sua revisão.
- Exportar, importar e mesclar backups preserva meta, prova e revisões; backups anteriores continuam abrindo com padrão seguro.
- Currículos automáticos, banco de questões e NotebookLM ficam fora do requisito de lançamento. A 1.0 já precisa funcionar sem serviço externo de estudo.

## Pendências para confirmar a 1.0

- **Notificações no navegador:** os lembretes levam à tarefa e podem ser adiados; testar entrega com o quadro fechado, reinício do navegador e permissões do sistema. A máquina desta revisão não tinha navegador com a extensão instalada disponível.
- **Backup no ambiente de uso:** os testes automatizados cobrem JSON/ZIP, arquivos, compatibilidade, colisões e rollback; ainda falta validar uma restauração real com a cópia do usuário antes da troca de versão.
- **Uso diário:** o plano, o fechamento do dia e a retomada estão implementados. Falta observar pelo menos uma semana de uso e registrar se a pessoa escolhe, executa e retoma sem depender de ferramentas paralelas.
- **Revisão de dependências:** uma tentativa de `npm audit` falhou porque este ambiente não conseguiu resolver `registry.npmjs.org`. Uma instalação anterior registrou uma vulnerabilidade alta, ainda sem pacote identificado nesta revisão.

A edição de uma rotina futura é possível pelos detalhes da tarefa. A edição direta com prévia no painel semanal melhoraria a descoberta, mas não bloqueia a alteração dos dias ou horário já existentes.

## Validação com uso real

Acompanhar voluntariamente, primeiro em uma semana de uso próprio e depois com usuários de teste: facilidade de escolher a próxima tarefa, lembretes úteis versus ignorados, compromissos concluídos e necessidade de ferramentas paralelas. Registrar relatos e problemas concretos; não adicionar coleta remota por causa deste documento. A experiência será essencial quando resolver uma necessidade repetida, e isso precisa ser observado no uso.

## Escopo e limites para comunicar

O quadro, as sessões e os arquivos continuam locais. Connections consultam o backend, mas não sincronizam o quadro entre dispositivos. Isso deve ficar claro na 1.0; sincronização pode ser uma fase posterior se a versão assumir explicitamente uso em um perfil de navegador. Backup e recuperação já existem e precisam fazer parte do teste de aceitação.

O versionamento continua em 0.9.0. Depois de fechar estas verificações, a mudança de versão na `main` aciona a automação do GitHub que valida o build remoto e os testes antes de publicar ZIP e Release.
