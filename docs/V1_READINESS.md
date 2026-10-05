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

## Prioridades propostas antes da 1.0

1. **Validar o plano diário no uso.** Já implementado: seleção explícita, ordem persistente, soma do esforço pendente e passagem para um ciclo revisável. `isVisible` ainda mantém a fila geral de pendências no quadro; o plano acima dela indica o compromisso escolhido. Critério de aceitação: escolher o próximo trabalho e perceber excesso de planejamento sem procurar pelo quadro inteiro. Ajustar capacidade e fechamento diário após observar o uso.
2. **Gerenciar rotinas antes da primeira ocorrência.** O painel de rotinas mostra dias e horário e permite excluir, mas a edição completa agora depende de abrir uma tarefa existente. Proposta: editar a própria programação no painel, inclusive rotinas futuras, com prévia da próxima ocorrência. Critério: trocar o horário ou pausar uma rotina sem esperar o dia dela e sem criar uma tarefa artificial.
3. **Transformar o lembrete em ação clara.** Hoje o clique abre o quadro existente. Proposta: selecionar a tarefa lembrada, com ações de iniciar foco ou adiar o lembrete; nada deve iniciar automaticamente. Critério: sair do aviso para a execução sem procurar o card. Testar antes a entrega real com o quadro fechado, reinício do navegador e suspensão do computador, inclusive permissões do sistema.
4. **Fechar o dia e retomar no seguinte.** Já existe revisão semanal. Proposta: um fechamento diário curto com conclusões, pendências e escolha do que continua amanhã, usando apenas dados locais reais. Critério: o usuário retoma um plano claro, preservando histórico e sem multiplicar tarefas atrasadas.

## Validação com uso real

Acompanhar voluntariamente, primeiro em uma semana de uso próprio e depois com usuários de teste: facilidade de escolher a próxima tarefa, lembretes úteis versus ignorados, compromissos concluídos e necessidade de ferramentas paralelas. Registrar relatos e problemas concretos; não adicionar coleta remota por causa deste documento. A experiência será essencial quando resolver uma necessidade repetida, e isso precisa ser observado no uso.

## Escopo e limites para comunicar

O quadro, as sessões e os arquivos continuam locais. Connections consultam o backend, mas não sincronizam o quadro entre dispositivos. Isso deve ficar claro na 1.0; sincronização pode ser uma fase posterior se a versão assumir explicitamente uso em um perfil de navegador. Backup e recuperação já existem e precisam fazer parte do teste de aceitação.

Não alterar a versão ou publicar uma release nesta etapa. Fechar os critérios aceitos e validar a extensão instalada antes de marcar 1.0.
