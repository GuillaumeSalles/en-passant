import { describe, expect, test } from "vitest";
import {
  buildPositionIndex,
  extractMovePgn,
  findMoveIdByPositionKey,
  movePositionKey,
  normalizePgn,
  toPgn,
} from "./pgnTree";

describe("extractMovePgn", () => {
  const source =
    "1. e4 (1. d4 d5) e5 (1... c5 2. Nf3 $1 {Develop} d6 (2... Nc6 3. Bb5) 3. d4) 2. Bc4 *";

  test.each([
    ["e4", "1. e4 e5 (1... c5 2. Nf3 $1 {Develop} d6 (2... Nc6 3. Bb5) 3. d4) 2. Bc4 *"],
    ["c5", "1. e4 c5 2. Nf3 $1 {Develop} d6 (2... Nc6 3. Bb5) 3. d4 *"],
    ["Nc6", "1. e4 c5 2. Nf3 $1 {Develop} Nc6 3. Bb5 *"],
    ["Bc4", "1. e4 e5 2. Bc4 *"],
  ])("extracts %s with its ancestors and all descendants", (san, expected) => {
    const pgn = normalizePgn(source);
    const original = toPgn(pgn);
    const move = Object.values(pgn.moves).find((candidate) => candidate.san === san)!;

    const extracted = extractMovePgn(pgn, move.id);

    expect(extracted).toBe(expected);
    const reparsed = normalizePgn(extracted!);
    expect(toPgn(reparsed)).toBe(expected);
    expect(
      Object.values(reparsed.moves)
        .map((candidate) => candidate.fen)
        .sort(),
    ).toEqual(
      Object.values(pgn.moves)
        .filter((candidate) =>
          Object.values(reparsed.moves).some((copy) => copy.fen === candidate.fen),
        )
        .map((candidate) => candidate.fen)
        .sort(),
    );
    expect(toPgn(pgn)).toBe(original);
  });

  test("preserves comments before moves and PGN annotation metadata", () => {
    const pgn = normalizePgn(
      "1. e4 e5 (1... {Sicilian} c5 $5 {[%cal Gc7c5] [%eval 0.2] Counterplay} 2. Nf3) *",
    );
    const move = Object.values(pgn.moves).find((candidate) => candidate.san === "c5")!;

    const extracted = extractMovePgn(pgn, move.id)!;

    expect(extracted).toBe(
      "1. e4 1... {Sicilian} c5 $5 {[%cal Gc7c5] [%eval 0.2] Counterplay} 2. Nf3 *",
    );
    expect(toPgn(normalizePgn(extracted))).toBe(extracted);
  });

  test("ignores a move that no longer exists", () => {
    expect(extractMovePgn(normalizePgn(source), -1)).toBeNull();
    expect(extractMovePgn(normalizePgn(""), 0)).toBeNull();
  });
});

describe("position keys", () => {
  test("selects the main-line occurrence of a transposed position", () => {
    const pgn = normalizePgn("1. Nf3 (1. d4 d5 2. Nf3) d5 2. d4 *");
    const terminalMoveIds = Object.values(pgn.moves)
      .filter((move) => move.next.length === 0)
      .map((move) => move.id);
    const positionKeys = terminalMoveIds.map((moveId) => movePositionKey(pgn, moveId));

    expect(new Set(positionKeys).size).toBe(1);
    const key = positionKeys[0] ?? null;
    expect(key).not.toBeNull();
    if (key === null) return;
    let mainLineTerminalMoveId = pgn.rootMoveIds[0];
    while (mainLineTerminalMoveId !== undefined) {
      const nextMoveId = pgn.moves[mainLineTerminalMoveId]?.next[0];
      if (nextMoveId === undefined) break;
      mainLineTerminalMoveId = nextMoveId;
    }
    expect(mainLineTerminalMoveId).toBeDefined();
    expect(findMoveIdByPositionKey(pgn, key)).toBe(mainLineTerminalMoveId);
  });

  test("indexes occurrences without merging their continuations", () => {
    const pgn = normalizePgn("1. Nf3 (1. d4 d5 2. Nf3 e6) d5 2. d4 Nf6 (2... c6) *");
    const index = buildPositionIndex(pgn.moves, pgn.rootMoveIds);
    const transposedEntry = [...index.byKey.values()].find(
      (entry) => entry.occurrenceMoveIds.length === 2,
    );

    expect(transposedEntry).toBeDefined();
    expect(transposedEntry?.occurrenceMoveIds[0]).toBe(transposedEntry?.canonicalMoveId);
    expect(transposedEntry?.occurrenceMoveIds).toHaveLength(2);
    expect(
      transposedEntry?.occurrenceMoveIds.map((moveId) =>
        pgn.moves[moveId]?.next.map((nextMoveId) => pgn.moves[nextMoveId]?.san),
      ),
    ).toEqual([["Nf6", "c6"], ["e6"]]);
  });

  test("does not select an unknown position", () => {
    const pgn = normalizePgn("1. e4 e5 *");

    expect(
      findMoveIdByPositionKey(pgn, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"),
    ).toBeNull();
  });
});
