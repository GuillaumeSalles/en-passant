import { describe, expect, test } from "vitest";
import { parsePgnMoves, parsePgnTags } from "./pgn-parser";

describe("parsePgnMoves", () => {
  test("ignores tags, move numbers, and result markers", () => {
    const moves = parsePgnMoves(`[Event "?"]
[Result "1-0"]

1.e4! $1 e5 2. Nf3 Nc6 1-0`);

    expect(moves.map((move) => move.notation.notation)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  test("preserves numeric and symbolic NAGs", () => {
    const moves = parsePgnMoves("1. e4! $9 e5? 2. Nf3!! Nc6 $19 3. Bb5!? a6 ?! *");

    expect(moves.map((move) => move.nags)).toEqual([[1, 9], [2], [3], [19], [5], [6]]);
  });

  test("attaches comments to the preceding move", () => {
    const moves = parsePgnMoves("1. e4 {best by test} e5 {} 2. Nf3 *");

    expect(moves[0]!.commentAfter).toBe("best by test");
    expect(moves[1]!.commentAfter).toBe("");
    expect(moves[2]!.commentAfter).toBeUndefined();
  });

  test("extracts clock and elapsed move time annotations from move comments", () => {
    const moves = parsePgnMoves(
      "1. e4 {[%clk 0:09:58]} e5 {[%emt 0:00:04] [%clk 0:09:56] book response} 2. Nf3 *",
    );

    expect(moves[0]!.clock).toBe("0:09:58");
    expect(moves[0]!.commentAfter).toBeUndefined();
    expect(moves[1]!.clock).toBe("0:09:56");
    expect(moves[1]!.timeSpent).toBe("0:00:04");
    expect(moves[1]!.commentAfter).toBe("book response");
  });

  test("parses PGN tags", () => {
    expect(
      parsePgnTags(`[Event "Rated rapid game"]
[TimeControl "600+5"]

1. e4 *`),
    ).toEqual({
      Event: "Rated rapid game",
      TimeControl: "600+5",
    });
  });

  test("attaches comments before moves when they precede a move token", () => {
    const moves = parsePgnMoves("{start} 1. e4 1... {before black} e5 2. {before knight} Nf3 *");

    expect(moves[0]!.commentBefore).toBe("start");
    expect(moves[1]!.commentBefore).toBe("before black");
    expect(moves[2]!.commentBefore).toBe("before knight");
  });

  test("attaches sibling and nested variations to the preceding move", () => {
    const moves = parsePgnMoves("1. e4 (1. d4 d5) (1. c4 (1. Nf3 Nf6) 1... e5) 1... c5 *");

    expect(moves[0]!.notation.notation).toBe("e4");
    expect(moves[0]!.variations).toHaveLength(2);
    expect(moves[0]!.variations[0]!.map((move) => move.notation.notation)).toEqual(["d4", "d5"]);
    expect(moves[0]!.variations[1]!.map((move) => move.notation.notation)).toEqual(["c4", "e5"]);
    expect(
      moves[0]!.variations[1]![0]!.variations[0]!.map((move) => move.notation.notation),
    ).toEqual(["Nf3", "Nf6"]);
  });

  test("throws on unterminated comments", () => {
    expect(() => parsePgnMoves("1. e4 {oops")).toThrow("Unterminated PGN comment");
  });
});
