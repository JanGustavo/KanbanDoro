import { dateFromDay, localDay } from './schedule.ts';

export type RecallRating = 'again' | 'hard' | 'good' | 'easy';
export type StudyReview = {
  id: string;
  taskId: string;
  dueDate: string;
  intervalDays: number;
  repetitions: number;
  lastRating?: RecallRating;
  lastRecall?: string;
  lastReviewedAt?: number;
};

export function nextStudyDay(day: string, days: number) {
  const date = dateFromDay(day);
  date.setDate(date.getDate() + days);
  return localDay(date);
}

export function ensureStudyReview(reviews: StudyReview[], taskId: string, today: string, makeId: () => string) {
  if (reviews.some(review => review.taskId === taskId)) return reviews;
  return [
    ...reviews,
    {
      id: makeId(),
      taskId,
      dueDate: nextStudyDay(today, 1),
      intervalDays: 1,
      repetitions: 0,
    },
  ];
}

export function rateStudyReview(
  reviews: StudyReview[],
  reviewId: string,
  rating: RecallRating,
  recall: string,
  today: string,
  now: number,
) {
  return reviews.map(review => {
    if (review.id !== reviewId) return review;
    const oldInterval = Math.max(1, review.intervalDays || 1);
    const intervalDays =
      rating === 'again'
        ? 1
        : rating === 'hard'
          ? Math.min(30, Math.max(1, Math.ceil(oldInterval * 1.2)))
          : rating === 'good'
            ? Math.min(60, review.repetitions ? Math.ceil(oldInterval * 2) : 3)
            : Math.min(90, review.repetitions ? Math.ceil(oldInterval * 2.5) : 7);
    return {
      ...review,
      dueDate: nextStudyDay(today, intervalDays),
      intervalDays,
      repetitions: rating === 'again' ? 0 : review.repetitions + 1,
      lastRating: rating,
      lastRecall: recall.trim().slice(0, 2000),
      lastReviewedAt: now,
    };
  });
}

export function studySecondsToday(
  history: Array<{ seconds: number; at: number; workflowProfile?: 'general' | 'study' }>,
  today: string,
) {
  return history.reduce(
    (sum, entry) =>
      Number.isFinite(entry.seconds) &&
      entry.seconds > 0 &&
      Number.isFinite(entry.at) &&
      entry.workflowProfile === 'study' &&
      localDay(new Date(entry.at)) === today
        ? sum + entry.seconds
        : sum,
    0,
  );
}
