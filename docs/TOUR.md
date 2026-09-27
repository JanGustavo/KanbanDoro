# Tutorial guiado

O KanbanDoro mostra **Ver tutorial** no aviso de primeiro uso. O botão `?` no cabeçalho permite repetir o tour depois. Os passos apresentam criação de tarefas, proposta de IA, quadro, filtros, Modo foco e ferramentas. **Próximo**, **Pular** e a tecla `Esc` encerram o fluxo sem alterar tarefas; a conclusão e o pulo registram `kanbandoroTourSeenV1` em `chrome.storage.local`. O quadro continua utilizável se o armazenamento falhar.

## Reutilizar o motor

`src/guidedTour.ts` não importa React nem depende de `chrome`. Quem usa o motor fornece `steps` e, se quiser persistência, um adaptador `{ get, set }` síncrono ou assíncrono. `start()` respeita o valor armazenado; `start({ force: true })` permite rever. Eventos opcionais: `onStart`, `onStepChange(step, index)`, `onComplete` e `onSkip`. Chame `destroy()` ao desmontar a tela.

```ts
import { GuidedTour } from './guidedTour';

const tour = new GuidedTour({
  steps: [{ selector: '#new-task', title: 'Primeira tarefa', description: 'Descreva sua próxima ação.' }],
  storage: {
    get: () => localStorage.getItem('tour-v1') === 'seen',
    set: seen => localStorage.setItem('tour-v1', seen ? 'seen' : ''),
  },
  onComplete: () => console.info('Tour concluído'),
});
void tour.start();
// Ao sair da tela: tour.destroy();
```

Ao mudar para Vue ou Svelte, monte o tour depois que os elementos de cada passo existirem e destrua a instância na limpeza do componente. O popover é posicionado dentro da viewport e recalculado ao rolar/redimensionar a janela. Passos cujo alvo não existe são ignorados. Títulos e descrições usam `textContent`, portanto não interpretam HTML. O CSS das classes `kb-tour-*` fica em `src/style.css` e pode ser copiado junto ao motor.
