# Fluxo diário e perfis de uso

Implementação de 16/10/2026. A versão permanece 0.9.0; este documento não anuncia a publicação da 1.0.

## Quatro fluxos implementados

### Retomar de onde parou

A tarefa tem um `resumePoint` opcional com etapa de referência, onde parou, próximo passo e data de atualização. A edição fica no foco e nos materiais da tarefa. Interromper um ciclo salva uma referência mesmo sem texto. A entrada mais recente entre tarefas pendentes e não arquivadas aparece no painel de retomada.

O usuário pode abrir os materiais ou confirmar a retomada de foco na próxima etapa pendente. Uma referência a uma etapa já concluída ou removida não reinicia essa etapa; a primeira etapa pendente passa a ser sugerida. O tempo reservado usa a estimativa da etapa quando houver, ou a da tarefa. Não há restauração de abas externas nem leitura de histórico do navegador.

### Fechar o dia

O usuário escolhe o dia do plano e um destino para cada pendência: próximo dia, fila sem data ou manter para revisar. Nada é movido enquanto faltar uma decisão ou houver ciclo/pausa ativo. A operação mantém os IDs, arquivos, colunas, histórico e pontos de retomada; somente os campos do plano mudam.

Um registro local em `dayClosures` guarda decisões, IDs concluídos e totais reais de foco daquele dia. O registro pode ser consultado no próprio fechamento; é identificado como fotografia do momento, separada do plano atual. Refechar a mesma data substitui explicitamente o resumo, sem duplicar registros. Fechar um dia anterior usa o dia seguinte àquela data, exibido na escolha, não pressupõe amanhã em relação à data atual.

### Lembrete com ação

A notificação abre a tarefa correspondente. Para rotinas, o destino inclui programação e data da ocorrência. O quadro existente é reutilizado sem recarregar o documento; cada solicitação tem um identificador novo para que o mesmo lembrete possa ser aberto novamente. A intenção de foco abre a tarefa para confirmação, preservando sessões ativas.

O segundo botão adia por dez minutos. O adiamento e seu estado de entrega ficam no armazenamento local, com um alarme reconciliado ao despertar o worker. Concluir, arquivar ou apagar a ocorrência cancela o adiamento. Editar/remover a programação também invalida o destino antigo. Os estados temporários de notificações não entram no backup.

O clique explícito numa ocorrência de rotina adiada de ontem pode gerá-la, caso ainda não tenha sido gerada/apagada. Isso não preenche automaticamente outros dias perdidos. Dias não programados e destinos inválidos não geram tarefas. Botões e pontualidade dependem do navegador e do sistema; o corpo do aviso continua abrindo a tarefa quando os botões não são apresentados.

### Primeiro uso com tarefa real

Em instalação vazia, o guia acompanha criar uma tarefa, planejar, registrar tempo de foco e guardar resultado ou próximo passo. Não injeta exemplos nem inicia cronômetro sozinho. O andamento é derivado da tarefa e de seus registros, com referência local à tarefa escolhida. O guia pode ser dispensado; Preferências → Quadro permite começar novamente. Essa preferência de apresentação não faz parte do backup, mas as tarefas e resultados fazem.

## Base de perfis, sem versões separadas

O núcleo continua único: tarefas, etapas, áreas, ciclos, continuidade e backups. `src/workflowProfiles.ts` define um catálogo declarativo de perfis conhecidos. `WorkflowSettings` permite escolher um perfil e um objetivo. O contrato validado pelo service worker é `{ profile, goal }`, com IDs conhecidos e limite de 500 caracteres para o objetivo. Perfis desconhecidos não executam código nem inserem instruções de sistema arbitrárias.

- **Geral:** mantém o planejamento habitual.
- **Estudo · base:** acrescenta contexto de estudo aos pedidos explícitos de proposta e análise de etapas, orientando compreensão, prática e revisão quando pertinentes. Permite adicionar áreas como Direito Penal, Administrativo e Constitucional, sem substituir áreas existentes. O pedido específico do usuário prevalece.

O perfil é global e opcional. Alterá-lo não reclassifica tarefas antigas, muda cronômetros ou envia dados à IA. Perfil e objetivo acompanham apenas a proposta de tarefa e a análise de etapas solicitadas; não são acrescentados à revisão semanal, que preserva seu contrato de agregados. As preferências e o ponto de retomada entram nos backups JSON e ZIP com valores padrão para arquivos antigos.

Esta base ainda não oferece currículo por edital, banco de questões, revisões espaçadas, perfis baixados da internet ou um gerenciador de plugins. O caminho proposto para expandir é adicionar perfis versionados no catálogo, validar o contrato correspondente no worker e oferecer sugestões revisáveis. “Skills” de estudo podem ser estratégias declarativas como leitura, questões e revisão, mantendo separadas as informações da tarefa e as instruções do aplicativo. Novas permissões e conexões pertencem a adaptadores explícitos, não ao simples ato de trocar de perfil.

## Integrações futuras e NotebookLM

A documentação oficial consultada em 16/10/2026 apresenta APIs em Preview para gerenciar notebooks e fontes no **Gemini Notebook Enterprise**, com configuração e licenciamento no Google Cloud:

- [Criar e gerenciar notebooks](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks).
- [Adicionar e gerenciar fontes](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks-sources).

Essas páginas não comprovam uma API de consulta ao chat do NotebookLM pessoal. Não implementamos leitura da conta pessoal, extração de cookies ou automação de APIs internas. Nenhuma credencial NotebookLM é solicitada nesta entrega.

Um futuro adaptador deve declarar capacidades separadas: listar notebooks, listar fontes, importar conteúdo e consultar respostas. Só deve habilitar as operações efetivamente documentadas e autorizadas. Retornar metadados não equivale a recuperar texto completo de uma fonte ou obter uma resposta fundamentada. O backend existente pode guardar os tokens do adaptador quando houver contrato viável; o perfil Estudo continua funcionando sem essa conexão.

## Aceitação e limites

Foram testados: persistência e fallback de retomada; fechamento atômico com decisão explícita e proteção de sessão; contagem de foco por dia; links de lembrete, adiamento e cancelamento por conclusão; perfil e objetivo sanitizados no worker; compatibilidade e preservação dos novos campos no backup. Na prévia com dados descartáveis, percorremos criação guiada, foco, registro de próximo passo, interrupção, recarga, fechamento e link direto à tarefa, além da seleção de Estudo e adição de disciplina.

Ainda é necessário validar a entrega nativa dos avisos e seus botões na extensão instalada, inclusive após suspensão e reinício do navegador. A prévia usa um adaptador de armazenamento descartável e não substitui esse teste de integração com o sistema.
