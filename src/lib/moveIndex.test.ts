import { describe, expect, test } from "vitest";
import { createChessPosition, positionKey } from "./chess";
import { indexPgnMoves, moveChildren } from "./moveIndex";
import { normalizePgn } from "./app-state/pgnTree";

describe("move occurrence indexing", () => {
  test("preserves main lines and nested variation order without merging occurrences", () => {
    const pgn = "1. e4 (1. d4 (1. c4) d5) (1. Nf3 d5) e5 (1... c5) 2. Nf3 *";
    const indexed = indexPgnMoves("chapter", pgn, "tree");
    const children = moveChildren(indexed);
    const normalized = normalizePgn(pgn);
    function indexedLines(parent: number | null): string[] {
      return (children.get(parent) ?? []).flatMap((move) => {
        const tails = indexedLines(move.moveId);
        return tails.length === 0 ? [move.uci] : tails.map((tail) => `${move.uci} ${tail}`);
      });
    }
    function originalLines(ids: number[]): string[] {
      return ids.flatMap((id) => {
        const move = normalized.moves[id];
        if (move === undefined) throw new Error("Missing move");
        const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
        const tails = originalLines(move.next);
        return tails.length === 0 ? [uci] : tails.map((tail) => `${uci} ${tail}`);
      });
    }
    expect(indexedLines(null)).toEqual(originalLines(normalized.rootMoveIds));
    expect(indexPgnMoves("game", pgn, "mainline").map((move) => move.san)).toEqual([
      "e4",
      "e5",
      "Nf3",
    ]);
    expect(new Set(indexed.map((move) => move.id)).size).toBe(indexed.length);
  });

  test("shares position keys across transpositions and preserves repeated visits", () => {
    const first = indexPgnMoves("first", "1. Nf3 d5 2. d4 Nf6 *", "mainline");
    const second = indexPgnMoves("second", "1. d4 d5 2. Nf3 Nf6 *", "mainline");
    expect(first[3]?.beforeKey).toBe(second[3]?.beforeKey);
    expect(first[3]?.id).not.toBe(second[3]?.id);
    const repeated = indexPgnMoves("repeat", "1. Nf3 Nf6 2. Ng1 Ng8 3. e4 *", "mainline");
    expect(
      repeated
        .filter((move) => move.beforeKey === positionKey(createChessPosition()))
        .map((move) => move.ply),
    ).toEqual([1, 5]);
  });

  test("uses setup positions, promotions, and legal en passant rights", () => {
    const setup = '[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 35"]\n\n35. a8=Q+ *';
    const promotion = indexPgnMoves("promotion", setup, "mainline")[0];
    expect(promotion).toMatchObject({
      uci: "a7a8q",
      ply: 1,
      beforeKey: "7k/P7/8/8/8/8/8/7K w - -",
    });
    const enPassant = indexPgnMoves("ep", "1. e4 a6 2. e5 d5 3. exd6 *", "mainline");
    expect(enPassant[4]?.beforeKey).toMatch(/ d6$/);
    expect(enPassant[1]?.beforeKey).toMatch(/ -$/);
    expect(indexPgnMoves("empty", "*", "tree")).toEqual([]);
    expect(() => indexPgnMoves("invalid", "1. e5 *", "tree")).toThrow();
  });
});
