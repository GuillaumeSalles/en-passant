import { describe, expect, test } from "vitest";
import { getVariationMoveIds } from "./training";
import { normalizePgn } from "./pgnTree";
import { getTrainingLines, trainingLineId } from "./trainingLines";

describe("training lines", () => {
  test("uses a stable URL-safe id derived from the moves", () => {
    const first = normalizePgn("1. e4 e5 2. Nf3 *");
    const second = normalizePgn("1. e4 $1 e5 {A comment} 2. Nf3 *");
    const firstMoves = getVariationMoveIds(first, getTrainingLines(first)[0]!.terminalMoveId).map(
      (moveId) => first.moves[moveId]!,
    );
    const secondMoves = getVariationMoveIds(
      second,
      getTrainingLines(second)[0]!.terminalMoveId,
    ).map((moveId) => second.moves[moveId]!);

    expect(trainingLineId(firstMoves)).toBe(trainingLineId(secondMoves));
    expect(trainingLineId(firstMoves)).toMatch(/^v1-[A-Za-z0-9_-]+$/);
  });

  test("returns leaf lines in PGN order", () => {
    const pgn = normalizePgn("1. e4 (1. d4 d5) e5 *");
    const labels = getTrainingLines(pgn).map((line) =>
      getVariationMoveIds(pgn, line.terminalMoveId)
        .map((moveId) => pgn.moves[moveId]!.san)
        .join(" "),
    );

    expect(labels).toEqual(["e4 e5", "d4 d5"]);
  });
});
