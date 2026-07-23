import { describe, expect, test } from "vitest";
import { getVariationMoveIds } from "./training";
import { normalizePgn } from "./pgnTree";
import {
  getTrainingLineByUciPath,
  getTrainingLines,
  getTrainingLinesWithScheduledPaths,
  isAlternativeTrainingMove,
  trainingLineId,
  trainingLineIdFromUciPath,
  trainingLineUciPathFromId,
} from "./trainingLines";

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
    expect(getTrainingLines(first, "white")[0]?.uciPath).toBe("e2e4 e7e5 g1f3");
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

  test("resolves a scheduled partial line and gives it a stable URL", () => {
    const pgn = normalizePgn("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *");
    const uciPath = "e2e4 e7e5 g1f3";
    const partial = getTrainingLineByUciPath(pgn, "white", uciPath);

    expect(partial).toMatchObject({ uciPath, plyCount: 3, terminalMoveId: 2 });
    expect(partial?.id).toBe(trainingLineIdFromUciPath(uciPath));
    expect(trainingLineUciPathFromId(partial?.id ?? "")).toBe(uciPath);
    expect(getTrainingLinesWithScheduledPaths(pgn, "white", [uciPath])).toHaveLength(2);
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
