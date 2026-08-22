import { describe, expect, test } from "vitest";
import { movePositionKey, normalizePgn } from "./pgnTree";
import { findOpening, type OpeningIndex } from "./openings";

function terminalMoveId(pgn: ReturnType<typeof normalizePgn>): number {
  const move = Object.values(pgn.moves).find((candidate) => candidate.next.length === 0);
  if (move === undefined) throw new Error("Expected a terminal move");
  return move.id;
}

function openingIndex(
  pgn: ReturnType<typeof normalizePgn>,
  moveId: number,
  name: string,
): OpeningIndex {
  const key = movePositionKey(pgn, moveId);
  if (key === null) throw new Error("Expected a position key");
  return new Map([[key, { eco: "D30", name }]]);
}

describe("opening classification", () => {
  test("recognizes an opening reached through a transposition", () => {
    const canonical = normalizePgn("1. d4 d5 2. c4 e6 3. Nf3 Nf6 *");
    const transposed = normalizePgn("1. Nf3 d5 2. d4 Nf6 3. c4 e6 *");
    const index = openingIndex(canonical, terminalMoveId(canonical), "Queen's Gambit Declined");

    expect(findOpening(transposed, terminalMoveId(transposed), index)).toEqual({
      eco: "D30",
      name: "Queen's Gambit Declined",
    });
  });

  test("returns the deepest named position in a line", () => {
    const pgn = normalizePgn("1. d4 d5 2. c4 e6 3. Nc3 Nf6 *");
    const moves = Object.values(pgn.moves).sort(
      (left, right) => left.halfMoveNumber - right.halfMoveNumber,
    );
    const queensGambitMove = moves[2];
    const declinedMove = moves[3];
    if (queensGambitMove === undefined || declinedMove === undefined) {
      throw new Error("Expected opening moves");
    }
    const queensGambitKey = movePositionKey(pgn, queensGambitMove.id);
    const declinedKey = movePositionKey(pgn, declinedMove.id);
    if (queensGambitKey === null || declinedKey === null) throw new Error("Expected position keys");
    const index: OpeningIndex = new Map([
      [queensGambitKey, { eco: "D06", name: "Queen's Gambit" }],
      [declinedKey, { eco: "D30", name: "Queen's Gambit Declined" }],
    ]);

    expect(findOpening(pgn, terminalMoveId(pgn), index)?.name).toBe("Queen's Gambit Declined");
  });
});
