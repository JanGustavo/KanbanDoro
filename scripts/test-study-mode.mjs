import assert from 'node:assert/strict';
import { ensureStudyReview, nextStudyDay, rateStudyReview, studySecondsToday } from '../src/studyMode.ts';
import { localDay } from '../src/schedule.ts';

assert.equal(nextStudyDay('2024-02-28', 1), '2024-02-29', 'calendar math handles leap days');

const first = ensureStudyReview([], 'topic-1', '2026-10-16', () => 'review-1');
assert.deepEqual(first[0], {
  id: 'review-1',
  taskId: 'topic-1',
  dueDate: '2026-10-17',
  intervalDays: 1,
  repetitions: 0,
});
assert.equal(
  ensureStudyReview(first, 'topic-1', '2026-10-16', () => 'duplicate'),
  first,
);

const firstGood = rateStudyReview(first, 'review-1', 'good', '  resposta lembrada  ', '2026-10-17', 123);
assert.equal(firstGood[0].dueDate, '2026-10-20', 'first good recall returns in three days');
assert.equal(firstGood[0].lastRecall, 'resposta lembrada');
assert.equal(firstGood[0].lastReviewedAt, 123);
const easy = rateStudyReview(firstGood, 'review-1', 'easy', '', '2026-10-20', 456);
assert.equal(easy[0].dueDate, '2026-10-28', 'easy recall grows the interval');
assert.equal(easy[0].repetitions, 2);
const forgotten = rateStudyReview(easy, 'review-1', 'again', 'não lembrei', '2026-10-28', 789);
assert.equal(forgotten[0].dueDate, '2026-10-29');
assert.equal(forgotten[0].repetitions, 0, 'forgotten topics restart the repetition count');
assert.equal(first[0].intervalDays, 1, 'rating a review does not mutate the original backup state');

const today = localDay(new Date(2026, 9, 16, 12));
const atToday = new Date(2026, 9, 16, 10).getTime();
assert.equal(
  studySecondsToday(
    [
      { seconds: 120, at: atToday, workflowProfile: 'study' },
      { seconds: 900, at: atToday, workflowProfile: 'general' },
      { seconds: -10, at: atToday, workflowProfile: 'study' },
      { seconds: Number.NaN, at: atToday, workflowProfile: 'study' },
      { seconds: 600, at: new Date(2026, 9, 15, 23, 59).getTime(), workflowProfile: 'study' },
    ],
    today,
  ),
  120,
  'daily goal counts only positive focus time from study sessions on the local day',
);

console.log('Modo Estudo: criação de revisões, intervalos adaptativos e meta diária local validados.');
