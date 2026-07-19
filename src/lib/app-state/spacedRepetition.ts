import type { TrainingLineReview } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_TRAINING_INTERVALS_MS: readonly number[] = [
  HOUR_MS,
  DAY_MS,
  3 * DAY_MS,
  7 * DAY_MS,
  14 * DAY_MS,
  30 * DAY_MS,
];

function intervalAt(intervals: readonly number[], index: number): number {
  const interval = intervals[index];
  if (interval === undefined) {
    throw new Error("Training intervals must contain at least one interval");
  }
  return interval;
}

export function initialTrainingReview(
  now: number,
  intervals: readonly number[] = DEFAULT_TRAINING_INTERVALS_MS,
): TrainingLineReview {
  return {
    intervalIndex: 0,
    dueAt: now + intervalAt(intervals, 0),
  };
}

export function nextTrainingReview(
  current: TrainingLineReview,
  successful: boolean,
  now: number,
  intervals: readonly number[] = DEFAULT_TRAINING_INTERVALS_MS,
): TrainingLineReview {
  const intervalIndex = successful ? Math.min(current.intervalIndex + 1, intervals.length - 1) : 0;
  return {
    intervalIndex,
    dueAt: now + intervalAt(intervals, intervalIndex),
  };
}

export function isTrainingReviewDue(review: TrainingLineReview | undefined, now: number): boolean {
  return review !== undefined && review.dueAt <= now;
}

export function prioritizeDueTrainingLines<T extends { id: string }>(
  lines: readonly T[],
  reviewsByLineId: Readonly<Record<string, TrainingLineReview | undefined>>,
  now: number,
): T[] {
  return lines
    .map((line, originalIndex) => ({ line, originalIndex }))
    .sort((left, right) => {
      const leftReview = reviewsByLineId[left.line.id];
      const rightReview = reviewsByLineId[right.line.id];
      const leftDue = isTrainingReviewDue(leftReview, now);
      const rightDue = isTrainingReviewDue(rightReview, now);
      if (leftDue !== rightDue) return leftDue ? -1 : 1;
      if (leftDue && rightDue && leftReview !== undefined && rightReview !== undefined) {
        const dueAtDifference = leftReview.dueAt - rightReview.dueAt;
        if (dueAtDifference !== 0) return dueAtDifference;
      }
      return left.originalIndex - right.originalIndex;
    })
    .map(({ line }) => line);
}
