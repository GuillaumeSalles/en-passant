import { describe, expect, test } from "vitest";
import { normalizePgn } from "./pgnTree";
import { getScheduledTrainingLines } from "./trainingQueue";
import { trainingLineReviewKey } from "./spacedRepetition";
import type { Chapter, Repertoire, TrainingLineReview } from "./types";

const repertoire: Repertoire = {
  id: "repertoire",
  handle: "white-repertoire",
  name: "White repertoire",
  orientation: "white",
};
const chapter: Chapter = {
  id: "chapter",
  repertoireId: repertoire.id,
  handle: "open-games",
  name: "Open games",
  pgnId: "pgn",
};

function review(uciPath: string, dueAt: number): TrainingLineReview {
  return {
    repertoireId: repertoire.id,
    chapterId: chapter.id,
    uciPath,
    intervalIndex: 1,
    dueAt,
    lastReviewedAt: 1,
    algorithmVersion: 1,
  };
}

describe("training queue", () => {
  test("resolves scheduled lines and orders the earliest due line first", () => {
    const later = review("e2e4 e7e5", 200);
    const earlier = review("d2d4 d7d5", 100);

    const lines = getScheduledTrainingLines(
      { [repertoire.id]: repertoire },
      { [chapter.id]: chapter },
      { [chapter.pgnId]: normalizePgn("1. e4 (1. d4 d5) e5 *") },
      {
        [trainingLineReviewKey(later.repertoireId, later.chapterId, later.uciPath)]: later,
        [trainingLineReviewKey(earlier.repertoireId, earlier.chapterId, earlier.uciPath)]: earlier,
      },
      150,
    );

    expect(lines.map((line) => ({ label: line.label, isDue: line.isDue }))).toEqual([
      { label: "d4 d5", isDue: true },
      { label: "e4 e5", isDue: false },
    ]);
  });

  test("ignores schedules whose repertoire line no longer exists", () => {
    const stale = review("e2e4 e7e5 g1f3", 100);

    expect(
      getScheduledTrainingLines(
        { [repertoire.id]: repertoire },
        { [chapter.id]: chapter },
        { [chapter.pgnId]: normalizePgn("1. e4 e5 *") },
        { [trainingLineReviewKey(stale.repertoireId, stale.chapterId, stale.uciPath)]: stale },
        150,
      ),
    ).toEqual([]);
  });

  test("resolves an imported mistake as a partial repertoire line", () => {
    const partial = review("e2e4 e7e5 g1f3", 0);
    const lines = getScheduledTrainingLines(
      { [repertoire.id]: repertoire },
      { [chapter.id]: chapter },
      { [chapter.pgnId]: normalizePgn("1. e4 e5 2. Nf3 Nc6 3. Bb5 *") },
      {
        [trainingLineReviewKey(partial.repertoireId, partial.chapterId, partial.uciPath)]: partial,
      },
      150,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      label: "e4 e5 Nf3",
      isDue: true,
      line: { uciPath: "e2e4 e7e5 g1f3", plyCount: 3 },
    });
  });
});
