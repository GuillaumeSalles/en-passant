import { describe, expect, test } from "vitest";
import {
  DEFAULT_TRAINING_INTERVALS_MS,
  initialTrainingReview,
  isTrainingReviewDue,
  nextTrainingReview,
  prioritizeDueTrainingLines,
} from "./spacedRepetition";

const intervals = [10, 20, 40] as const;

describe("spaced repetition", () => {
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
    const initial = initialTrainingReview(100, intervals);
    const second = nextTrainingReview(initial, true, 110, intervals);
    const third = nextTrainingReview(second, true, 130, intervals);
    const repeatedFinal = nextTrainingReview(third, true, 170, intervals);

    expect(initial).toEqual({ intervalIndex: 0, dueAt: 110 });
    expect(second).toEqual({ intervalIndex: 1, dueAt: 130 });
    expect(third).toEqual({ intervalIndex: 2, dueAt: 170 });
    expect(repeatedFinal).toEqual({ intervalIndex: 2, dueAt: 210 });
  });

  test("a failed training returns to the first interval", () => {
    expect(nextTrainingReview({ intervalIndex: 2, dueAt: 100 }, false, 200, intervals)).toEqual({
      intervalIndex: 0,
      dueAt: 210,
    });
  });

  test("puts due lines first, ordered from most overdue", () => {
    const lines = [{ id: "future" }, { id: "due-later" }, { id: "unscheduled" }, { id: "due" }];

    expect(
      prioritizeDueTrainingLines(
        lines,
        {
          future: { intervalIndex: 0, dueAt: 300 },
          "due-later": { intervalIndex: 0, dueAt: 190 },
          due: { intervalIndex: 0, dueAt: 150 },
        },
        200,
      ).map((line) => line.id),
    ).toEqual(["due", "due-later", "future", "unscheduled"]);
    expect(isTrainingReviewDue({ intervalIndex: 0, dueAt: 200 }, 200)).toBe(true);
  });
});
