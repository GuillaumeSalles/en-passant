import { describe, expect, test } from "vitest";
import { buildMoveRows } from "./moveRows";
import { normalizePgn } from "./pgnTree";

function rowsFromPgn(pgn: string) {
  const normalizedPgn = normalizePgn(pgn);
  return buildMoveRows(normalizedPgn.moves, normalizedPgn.rootMoveIds, null);
}

describe("buildMoveRows", () => {
  test("groups main-line white and black moves into rows", () => {
    expect(rowsFromPgn("1. e4 e5 2. Nf3 Nc6 *")).toMatchObject([
      {
        id: "main-0-1",
        type: "main",
        index: 1,
        whiteMove: { moveId: 0, class: "w-14" },
        blackMove: { moveId: 1, class: "w-14" },
      },
      {
        id: "main-2-3",
        type: "main",
        index: 2,
        whiteMove: { moveId: 2, class: "w-14" },
        blackMove: { moveId: 3, class: "w-14" },
      },
    ]);
  });

  test("renders sibling root lines as variations after the first root move", () => {
    expect(rowsFromPgn("1. e4 (1. d4 d5) e5 *")).toMatchObject([
      {
        id: "partial-white-2",
        type: "main",
        whiteMove: { moveId: 2 },
        blackMove: "dots",
      },
      {
        id: "variation-0",
        type: "variation",
        indent: 1,
        items: [
          { type: "move-number", moveNumber: 1, isWhite: true },
          { type: "move", move: { moveId: 0, canPromoteVariation: true } },
          { type: "move", move: { moveId: 1, canPromoteVariation: true } },
        ],
      },
      {
        id: "partial-black-3",
        type: "main",
        whiteMove: "dots",
        blackMove: { moveId: 3 },
      },
    ]);
  });

  test("keeps comments on separate rows and supports requested empty comments", () => {
    const normalizedPgn = normalizePgn("1. e4 {best by test} e5 *");
    const rows = buildMoveRows(normalizedPgn.moves, normalizedPgn.rootMoveIds, {
      moveId: 1,
      placement: "before",
      version: 4,
    });

    expect(rows).toMatchObject([
      {
        id: "partial-white-0",
        commentAfter: { moveId: 0, placement: "after", comment: "best by test" },
      },
      {
        id: "partial-black-1",
        commentBefore: {
          moveId: 1,
          placement: "before",
          comment: "",
          editRequestVersion: 4,
        },
      },
    ]);
  });
});
