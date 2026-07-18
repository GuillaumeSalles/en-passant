import { describe, expect, test } from "vitest";
import { getVariationMoveIds } from "./training";
import { normalizePgn } from "./pgnTree";
import { getTrainingLines, isAlternativeTrainingMove, trainingLineId } from "./trainingLines";

describe("training lines", () => {
  test("uses a stable URL-safe id derived from the moves", () => {
    const first = normalizePgn("1. e4 e5 2. Nf3 *");
    const second = normalizePgn("1. e4 $1 e5 {A comment} 2. Nf3 *");
    const firstMoves = getVariationMoveIds(
      first,
      getTrainingLines(first, "white")[0]!.terminalMoveId,
    ).map((moveId) => first.moves[moveId]!);
    const secondMoves = getVariationMoveIds(
      second,
      getTrainingLines(second, "white")[0]!.terminalMoveId,
    ).map((moveId) => second.moves[moveId]!);

    expect(trainingLineId(firstMoves)).toBe(trainingLineId(secondMoves));
    expect(trainingLineId(firstMoves)).toMatch(/^v1-[A-Za-z0-9_-]+$/);
  });

  test("returns leaf lines in PGN order", () => {
    const pgn = normalizePgn("1. e4 (1. d4 d5) e5 *");
    const labels = getTrainingLines(pgn, "white").map((line) =>
      getVariationMoveIds(pgn, line.terminalMoveId)
        .map((moveId) => pgn.moves[moveId]!.san)
        .join(" "),
    );

    expect(labels).toEqual(["e4 e5", "d4 d5"]);
  });

  test("marks only branches on the repertoire user's turns as alternative lines", () => {
    const whiteChoices = normalizePgn("1. e4 (1. d4 d5) e5 *");
    expect(getTrainingLines(whiteChoices, "white").map((line) => line.isAlternative)).toEqual([
      false,
      true,
    ]);
    expect(getTrainingLines(whiteChoices, "black").map((line) => line.isAlternative)).toEqual([
      false,
      false,
    ]);

    const blackChoices = normalizePgn("1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *");
    expect(getTrainingLines(blackChoices, "black").map((line) => line.isAlternative)).toEqual([
      false,
      true,
    ]);
    expect(getTrainingLines(blackChoices, "white").map((line) => line.isAlternative)).toEqual([
      false,
      false,
    ]);
  });

  test("recognizes a sibling repertoire move without accepting the expected move", () => {
    const pgn = normalizePgn("1. e4 (1. d4 d5) e5 *");
    const expectedMoveId = pgn.rootMoveIds[0]!;

    expect(isAlternativeTrainingMove(pgn, expectedMoveId, "white", "d2", "d4")).toBe(true);
    expect(isAlternativeTrainingMove(pgn, expectedMoveId, "white", "e2", "e4")).toBe(false);
    expect(isAlternativeTrainingMove(pgn, expectedMoveId, "black", "d2", "d4")).toBe(false);
    expect(isAlternativeTrainingMove(pgn, expectedMoveId, "white", "g1", "f3")).toBe(false);
  });
});
