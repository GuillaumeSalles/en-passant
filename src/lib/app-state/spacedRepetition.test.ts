import { describe, expect, test } from "vitest";
import {
  DEFAULT_TRAINING_INTERVALS_MS,
  initialTrainingReview,
  isTrainingReviewDue,
  nextTrainingReview,
  prioritizeDueTrainingLines,
  trainingMasteryLevel,
} from "./spacedRepetition";

const intervals = [10, 20, 40] as const;
const identity = { repertoireId: "rep-1", chapterId: "chapter-1", uciPath: "e2e4 e7e5" };
const review = (intervalIndex: number, dueAt: number) => ({
  ...identity,
  intervalIndex,
  dueAt,
  lastReviewedAt: 90,
  algorithmVersion: 1,
});

describe("spaced repetition", () => {
  test("maps schedule intervals to visible mastery levels", () => {
    expect([
      trainingMasteryLevel(undefined),
      trainingMasteryLevel(0),
      trainingMasteryLevel(1),
      trainingMasteryLevel(2),
      trainingMasteryLevel(3),
      trainingMasteryLevel(4),
      trainingMasteryLevel(5),
      trainingMasteryLevel(6),
    ]).toEqual([
      "new",
      "learning",
      "familiar",
      "practiced",
      "reliable",
      "strong",
      "mastered",
      "mastered",
    ]);
  });

  test("uses the initial review cadence", () => {
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    expect(DEFAULT_TRAINING_INTERVALS_MS).toEqual([
      hour,
      day,
      3 * day,
      7 * day,
      14 * day,
      30 * day,
    ]);
  });

  test("uses the configured intervals and repeats the final interval", () => {
    const initial = initialTrainingReview(identity, 100, intervals);
    const second = nextTrainingReview(initial, true, 110, intervals);
    const third = nextTrainingReview(second, true, 130, intervals);
    const repeatedFinal = nextTrainingReview(third, true, 170, intervals);

    expect(initial).toEqual({
      ...identity,
      intervalIndex: 0,
      dueAt: 110,
      lastReviewedAt: 100,
      algorithmVersion: 1,
    });
    expect(second).toEqual({
      ...identity,
      intervalIndex: 1,
      dueAt: 130,
      lastReviewedAt: 110,
      algorithmVersion: 1,
    });
    expect(third).toEqual({
      ...identity,
      intervalIndex: 2,
      dueAt: 170,
      lastReviewedAt: 130,
      algorithmVersion: 1,
    });
    expect(repeatedFinal).toEqual({
      ...identity,
      intervalIndex: 2,
      dueAt: 210,
      lastReviewedAt: 170,
      algorithmVersion: 1,
    });
  });

  test("a failed training returns to the first interval", () => {
    expect(nextTrainingReview(review(2, 100), false, 200, intervals)).toEqual({
      ...identity,
      intervalIndex: 0,
      dueAt: 210,
      lastReviewedAt: 200,
      algorithmVersion: 1,
    });
  });

  test("puts due lines first, ordered from most overdue", () => {
    const lines = [{ id: "future" }, { id: "due-later" }, { id: "unscheduled" }, { id: "due" }];

    expect(
      prioritizeDueTrainingLines(
        lines,
        {
          future: review(0, 300),
          "due-later": review(0, 190),
          due: review(0, 150),
        },
        200,
      ).map((line) => line.id),
    ).toEqual(["due", "due-later", "future", "unscheduled"]);
    expect(isTrainingReviewDue(review(0, 200), 200)).toBe(true);
  });
});
