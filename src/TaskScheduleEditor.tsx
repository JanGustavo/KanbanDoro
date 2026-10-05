import { useState } from 'react';
import type { Task } from './main';
import { dateFromDay, localDay, weekEnd, type WeeklyPlan } from './schedule';

import type { ScheduleEdit as Choice } from './taskScheduling';
const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function TaskScheduleEditor({
  task,
  plan,
  onSave,
}: {
  task: Task;
  plan?: WeeklyPlan;
  onSave: (choice: Choice) => void;
}) {
  const [choice, setChoice] = useState<Choice>({
    mode: plan ? (plan.endsOn ? 'selected-days' : 'weekly') : 'once',
    startDate: plan?.startsOn ?? task.reminderDate ?? localDay(new Date()),
    weekdays: plan?.weekdays ?? [new Date().getDay()],
    reminderTime: plan?.reminderTime ?? task.reminderTime ?? '',
  });
  const [message, setMessage] = useState('');
  return (
    <fieldset className="schedule-choice">
      <legend>Recorrência e lembrete</legend>
      <label>
        Repetição{' '}
        <select
          value={choice.mode}
          onChange={e => {
            setMessage('');
            setChoice(old => ({ ...old, mode: e.target.value as Choice['mode'] }));
          }}
        >
          <option value="once">Uma vez</option>
          <option value="selected-days">Só na semana escolhida</option>
          <option value="weekly">Toda semana (fixa)</option>
        </select>
      </label>
      {(choice.mode !== 'once' || choice.reminderTime) && (
        <label>
          {choice.mode === 'once' ? 'Dia do lembrete' : 'Começar em'}{' '}
          <input
            type="date"
            value={choice.startDate}
            onChange={e => setChoice(old => ({ ...old, startDate: e.target.value }))}
          />
        </label>
      )}
      {choice.mode !== 'once' && (
        <div className="weekdays" role="group" aria-label="Dias de repetição da tarefa">
          {days.map((day, index) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={choice.weekdays.includes(index)}
                onChange={() =>
                  setChoice(old => ({
                    ...old,
                    weekdays: old.weekdays.includes(index)
                      ? old.weekdays.filter(value => value !== index)
                      : [...old.weekdays, index],
                  }))
                }
              />
              {day}
            </label>
          ))}
        </div>
      )}
      <label>
        Horário do lembrete (opcional){' '}
        <input
          type="time"
          value={choice.reminderTime}
          onChange={e => setChoice(old => ({ ...old, reminderTime: e.target.value }))}
        />
      </label>
      <p>
        {choice.mode === 'weekly'
          ? 'Uma tarefa independente por dia escolhido, toda semana, até você parar a repetição.'
          : choice.mode === 'selected-days'
            ? 'Repete só até o domingo da semana escolhida.'
            : 'Sem novas ocorrências.'}
      </p>
      <small>
        Horário local do navegador. O lembrete funciona com o quadro fechado. Se o navegador estiver fechado, avisa ao
        reabrir no mesmo dia.
      </small>
      {plan && (
        <p>
          Salvar atualiza as próximas ocorrências com o nome, descrição, área, estimativa, links e slices atuais. O
          histórico e as outras tarefas já criadas são preservados. Escolha Uma vez para parar esta rotina.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          if (choice.mode !== 'once' || choice.reminderTime) {
            const start = dateFromDay(choice.startDate);
            if (
              !choice.startDate ||
              localDay(start) !== choice.startDate ||
              (choice.mode !== 'once' && !choice.weekdays.length)
            ) {
              setMessage('Escolha uma data válida e ao menos um dia para a repetição.');
              return;
            }
            if (
              choice.mode === 'selected-days' &&
              !Array.from({ length: 7 }, (_, offset) => {
                const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, 12);
                return localDay(day) <= weekEnd(start) && choice.weekdays.includes(day.getDay());
              }).some(Boolean)
            ) {
              setMessage('Não há dias selecionados restantes nesta semana.');
              return;
            }
          }
          onSave(choice);
          setMessage('Programação salva.');
        }}
      >
        Salvar programação
      </button>
      <p role="status">{message}</p>
    </fieldset>
  );
}
