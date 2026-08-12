import { describe, expect, test } from "vitest";
import { createStore } from "@/lib/createStore";
import { chapterStub, repertoireStub } from "@/tests/stubs";
import { mergeChapterPgn } from "./mutations";
import { emptyState, getPgn } from "./state";
import { normalizePgn, toPgn } from "./pgnTree";
import type { Context } from "./types";

const ctx: Context = {
  type: "repertoire-builder",
  repertoireHandle: "white",
  chapterHandle: "main",
};

function chapterState(pgn: string) {
  const repertoire = repertoireStub({ id: "repertoire-1", handle: "white" });
  const chapter = chapterStub({
    id: "chapter-1",
    repertoireId: repertoire.id,
    handle: "main",
    pgnId: "pgn-1",
  });
  return createStore({
    ...emptyState(),
    repertoires: { status: "success" as const, data: { [repertoire.id]: repertoire } },
    chapters: { status: "success" as const, data: { [chapter.id]: chapter } },
    pgns: { [chapter.pgnId]: { status: "success" as const, data: normalizePgn(pgn) } },
  }).state;
}

describe("mergeChapterPgn", () => {
  test("merges branches and annotations into the loaded chapter", () => {
    const state = chapterState("1. e4 e5 2. Nf3 *");

    const effects = mergeChapterPgn(state, ctx, "1. e4! {Take the center.} c5 2. Nf3 d6 *");

    const merged = getPgn(state, ctx);
    expect(merged === null ? null : toPgn(merged)).toBe(
      "1. e4 $1 {Take the center.} e5 (1... c5 2. Nf3 d6) 2. Nf3 *",
    );
    expect(effects).toEqual(
      expect.objectContaining({
        type: "persist-pgn-mutations",
        pgnId: "pgn-1",
        mutations: expect.arrayContaining([
          expect.objectContaining({
            type: "setAnnotations",
            path: ["e2e4"],
          }),
          expect.objectContaining({
            type: "addMove",
            parentPath: ["e2e4"],
            move: "c7c5",
          }),
          expect.objectContaining({
            type: "addMove",
            parentPath: ["e2e4", "c7c5", "g1f3"],
            move: "d7d6",
          }),
        ]),
      }),
    );
  });

  test("is safe when the current chapter PGN is unavailable", () => {
    const state = createStore(emptyState()).state;

    expect(mergeChapterPgn(state, ctx, "not valid pgn")).toBeUndefined();
  });

  test("rejects malformed PGN without changing the chapter", () => {
    const state = chapterState("1. e4 e5 *");

    expect(() => mergeChapterPgn(state, ctx, "1. d4 {unterminated")).toThrow(
      "Unterminated PGN comment",
    );
    expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 e5 *");
  });
});
