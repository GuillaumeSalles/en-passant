import { describe, expect, test } from "vitest";
import { normalizePgn } from "./pgnTree";
import {
  DEFAULT_TRAINING_INTERVALS_MS,
  TRAINING_MASTERY_LEVELS,
  trainingMasteryLevel,
} from "./spacedRepetition";
import {
  getLineMoveTargets,
  getTrainingMoveTarget,
  getTrainingMovesToSkip,
  getTrainingMoveTargets,
  nextTrainingMoveReview,
  trainingMoveProgress,
  trainingMoveReviewKey,
} from "./trainingMoves";

function targets(pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5 *") {
  return getTrainingMoveTargets("r", normalizePgn(pgn), "white");
}
const identity = { repertoireId: "r", positionKey: "position", uci: "e2e4" };

describe("move knowledge", () => {
  test("skips only future decisions and their replies, stopping at new or exactly due moves", () => {
    const pgn = normalizePgn("1. e4 e5 2. Nf3 Nc6 3. Bb5 *");
    const moves = Object.values(pgn.moves).sort((a, b) => a.halfMoveNumber - b.halfMoveNumber);
    const ids = moves.map((move) => move.id);
    const targets = getTrainingMoveTargets("r", pgn, "white");
    const reviews = Object.fromEntries(
      targets.map((target) => [
        target.key,
        {
          ...nextTrainingMoveReview(target, undefined, "correct", 0),
          dueAt: 101,
        },
      ]),
    );
    expect(getTrainingMovesToSkip("r", pgn, "white", ids, reviews, 100)).toEqual(moves);
    expect(getTrainingMovesToSkip("r", pgn, "white", ids, reviews, 101)).toEqual([]);
    const second = targets[1];
    if (second === undefined) throw new Error("Missing target");
    delete reviews[second.key];
    expect(getTrainingMovesToSkip("r", pgn, "white", ids, reviews, 100).map((m) => m.san)).toEqual([
      "e4",
      "e5",
    ]);
    expect(getTrainingMovesToSkip("other", pgn, "white", ids, reviews, 100)).toEqual([]);
    expect(getTrainingMovesToSkip("r", pgn, "white", [999], reviews, 100)).toEqual([]);
  });
  test("reuses every interval and mastery level and caps at mastered", () => {
    let review = nextTrainingMoveReview(identity, undefined, "learned", 100);
    for (const [index, interval] of DEFAULT_TRAINING_INTERVALS_MS.entries()) {
      expect(review.dueAt - review.lastReviewedAt).toBe(interval);
      expect(trainingMasteryLevel(review.intervalIndex)).toBe(TRAINING_MASTERY_LEVELS[index]);
      review = nextTrainingMoveReview(identity, review, "correct", review.dueAt);
    }
    expect(review.intervalIndex).toBe(DEFAULT_TRAINING_INTERVALS_MS.length - 1);
  });

  test("early practice and demonstrations preserve progress, including a failure", () => {
    const learned = nextTrainingMoveReview(identity, undefined, "learned", 100);
    const familiar = nextTrainingMoveReview(identity, learned, "correct", learned.dueAt);
    expect(nextTrainingMoveReview(identity, familiar, "correct", familiar.lastReviewedAt + 1)).toBe(
      familiar,
    );
    expect(nextTrainingMoveReview(identity, familiar, "learned", familiar.dueAt)).toBe(familiar);
    const failed = nextTrainingMoveReview(identity, familiar, "incorrect", familiar.dueAt);
    expect(failed).toMatchObject({
      intervalIndex: 0,
      lapses: 1,
      lastOutcome: "incorrect",
      successes: 1,
    });
    expect(failed.dueAt - failed.lastReviewedAt).toBe(DEFAULT_TRAINING_INTERVALS_MS[0]);
    expect(nextTrainingMoveReview(identity, failed, "correct", failed.lastReviewedAt + 1)).toBe(
      failed,
    );
  });

  test("a first unaided success starts learning, without claiming familiarity", () => {
    expect(nextTrainingMoveReview(identity, undefined, "correct", 100)).toMatchObject({
      intervalIndex: 0,
      successes: 1,
      lapses: 0,
    });
  });

  test("tracks only the repertoire side and deduplicates shared prefixes", () => {
    const pgn = normalizePgn("1. e4 e5 2. Nf3 (2. Bc4) Nc6 *");
    expect(getTrainingMoveTargets("r", pgn, "white").map((target) => target.san)).toEqual([
      "e4",
      "Nf3",
      "Bc4",
    ]);
    expect(getTrainingMoveTargets("r", pgn, "black").map((target) => target.san)).toEqual([
      "e5",
      "Nc6",
    ]);
  });

  test("shares transposed decisions within a repertoire, but not across repertoires", () => {
    const pgn = normalizePgn("1. Nf3 (1. g3 d5 2. Nf3 Nf6 3. Bg2) d5 2. g3 Nf6 3. Bg2 *");
    const bishops = Object.values(pgn.moves).filter((move) => move.san === "Bg2");
    expect(bishops).toHaveLength(2);
    const keys = bishops.map((move) => getTrainingMoveTarget("r", pgn, move.id, "white")?.key);
    expect(new Set(keys).size).toBe(1);
    expect(
      getTrainingMoveTargets("r", pgn, "white").filter((move) => move.san === "Bg2"),
    ).toHaveLength(1);
    expect(getTrainingMoveTargets("other", pgn, "white")[0]?.key).not.toBe(
      getTrainingMoveTargets("r", pgn, "white")[0]?.key,
    );
  });

  test("identity survives annotations, reordered variations and longer continuations", () => {
    const before = targets("1. e4 (1. d4) e5 2. Nf3 *");
    const after = targets("1. d4 (1. e4 $1 {Center} e5 2. Nf3 Nc6 3. Bb5) *");
    expect(after.find((target) => target.san === "Nf3")?.key).toBe(
      before.find((target) => target.san === "Nf3")?.key,
    );
  });

  test("promotion choices have separate identities", () => {
    expect(trainingMoveReviewKey({ ...identity, uci: "a7a8q" })).not.toBe(
      trainingMoveReviewKey({ ...identity, uci: "a7a8n" }),
    );
  });

  test("unseen decisions prevent a line from appearing fully learned", () => {
    const moves = targets();
    const first = moves[0];
    if (first === undefined) throw new Error("Missing move");
    const review = nextTrainingMoveReview(first, undefined, "correct", 100);
    const progress = trainingMoveProgress(moves, { [first.key]: review }, review.dueAt);
    expect(progress).toMatchObject({
      total: 3,
      learned: 1,
      familiar: 0,
      due: 1,
      intervalIndex: undefined,
    });
  });

  test("a missed move resets independently and line progress reflects the weakest decision", () => {
    const moves = targets();
    const reviews = Object.fromEntries(
      moves.map((move) => {
        const first = nextTrainingMoveReview(move, undefined, "correct", 100);
        return [move.key, nextTrainingMoveReview(move, first, "correct", first.dueAt)];
      }),
    );
    expect(trainingMoveProgress(moves, reviews, 100)).toMatchObject({
      familiar: 3,
      intervalIndex: 1,
    });
    const missed = moves[1];
    if (missed === undefined) throw new Error("Missing target");
    reviews[missed.key] = nextTrainingMoveReview(
      missed,
      reviews[missed.key],
      "incorrect",
      4_000_000,
    );
    expect(trainingMoveProgress(moves, reviews, 4_000_000)).toMatchObject({
      learned: 3,
      familiar: 2,
      intervalIndex: 0,
      due: 0,
    });
  });

  test("missing paths and move IDs safely resolve to no target", () => {
    const pgn = normalizePgn("1. e4 *");
    expect(getTrainingMoveTarget("r", pgn, 999, "white")).toBeNull();
    expect(getLineMoveTargets("r", pgn, "white", "e2e4 e7e5 g1f3")).toEqual([]);
  });
});

test("a repeated decision retains the terminal source path without duplicating knowledge", () => {
  const pgn = normalizePgn("1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 *");
  const path = "g1f3 g8f6 f3g1 f6g8 g1f3";
  const moves = getLineMoveTargets("r", pgn, "white", path);
  expect(moves).toHaveLength(2);
  expect(moves.find((target) => target.uciPath === path)).toMatchObject({ san: "Nf3", ply: 5 });
  expect(moves.find((target) => target.uciPath === path)?.key).toBe(
    getTrainingMoveTargets("r", pgn, "white")[0]?.key,
  );
});
