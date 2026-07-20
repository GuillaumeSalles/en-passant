import { describe, expect, test } from "vitest";
import { pgnMutationsBetween } from "./pgnMutations";

describe("pgnMutationsBetween", () => {
  test("creates an initial replacement snapshot", () => {
    expect(pgnMutationsBetween(undefined, "1. e4 *")).toEqual([
      { type: "replacePgn", pgn: "1. e4 *" },
    ]);
  });

  test("returns no mutations for identical PGNs", () => {
    expect(pgnMutationsBetween("1. e4 e5 *", "1. e4 e5 *")).toEqual([]);
  });

  test("describes an added continuation using its parent path", () => {
    expect(pgnMutationsBetween("1. e4 *", "1. e4 e5 *")).toEqual([
      {
        type: "addMove",
        parentPath: ["e2e4"],
        move: "e7e5",
        annotations: { nags: [], commentBefore: null, commentAfter: null },
      },
      {
        type: "reorderVariations",
        parentPath: ["e2e4"],
        childMoves: ["e7e5"],
      },
    ]);
  });

  test("adds a complete subtree parent-first", () => {
    const mutations = pgnMutationsBetween("1. e4 *", "1. e4 c5 2. Nf3 *");
    expect(mutations.filter((mutation) => mutation.type === "addMove")).toMatchObject([
      { parentPath: ["e2e4"], move: "c7c5" },
      { parentPath: ["e2e4", "c7c5"], move: "g1f3" },
    ]);
  });

  test("deletes only the root of a removed subtree", () => {
    expect(pgnMutationsBetween("1. e4 e5 2. Nf3 *", "1. e4 *")).toEqual([
      { type: "deleteSubtree", path: ["e2e4", "e7e5"] },
      { type: "reorderVariations", parentPath: ["e2e4"], childMoves: [] },
    ]);
  });

  test("updates annotations at a stable move path", () => {
    expect(pgnMutationsBetween("1. e4 *", "1. e4 $1 {Center} *")).toEqual([
      {
        type: "setAnnotations",
        path: ["e2e4"],
        annotations: { nags: [1], commentBefore: null, commentAfter: "Center" },
      },
    ]);
  });

  test("preserves PGN metadata in the annotation payload", () => {
    const mutations = pgnMutationsBetween(
      "1. e4 {[%clk 0:10:00]} *",
      "1. e4 {[%clk 0:09:58] Center} *",
    );
    expect(mutations).toMatchObject([
      {
        type: "setAnnotations",
        path: ["e2e4"],
        annotations: { commentAfter: "[%clk 0:09:58] Center" },
      },
    ]);
  });

  test("represents variation promotion as ordering, not new identities", () => {
    expect(pgnMutationsBetween("1. e4 e5 (1... c5) *", "1. e4 c5 (1... e5) *")).toEqual([
      {
        type: "reorderVariations",
        parentPath: ["e2e4"],
        childMoves: ["c7c5", "e7e5"],
      },
    ]);
  });
});
