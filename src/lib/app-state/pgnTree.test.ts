import { describe, expect, test } from "vitest";
import {
  buildPositionIndex,
  findMoveIdByPositionKey,
  movePositionKey,
  normalizePgn,
} from "./pgnTree";

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
