import { describe, expect, test } from "vitest";
import { findMoveIdByPositionKey, movePositionKey, normalizePgn } from "./pgnTree";

describe("position keys", () => {
  test("selects the first parser occurrence of a transposed position", () => {
    const pgn = normalizePgn("1. Nf3 (1. d4 d5 2. Nf3) d5 2. d4 *");
    const terminalMoveIds = Object.values(pgn.moves)
      .filter((move) => move.next.length === 0)
      .map((move) => move.id);
    const positionKeys = terminalMoveIds.map((moveId) => movePositionKey(pgn, moveId));

    expect(new Set(positionKeys).size).toBe(1);
    const key = positionKeys[0] ?? null;
    expect(key).not.toBeNull();
    if (key === null) return;
    expect(findMoveIdByPositionKey(pgn, key)).toBe(Math.min(...terminalMoveIds));
  });

  test("does not select an unknown position", () => {
    const pgn = normalizePgn("1. e4 e5 *");

    expect(
      findMoveIdByPositionKey(pgn, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"),
    ).toBeNull();
  });
});
