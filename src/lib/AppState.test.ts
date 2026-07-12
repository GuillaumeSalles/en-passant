import fs from "node:fs/promises";
import { test, expect, describe } from "vitest";
import { createStore, StoreState } from "@/lib/createStore";
import {
  arrowDown,
  arrowUp,
  back,
  deleteMove,
  emptyState,
  forward,
  moveFromChessboard,
  promoteVariation,
  replaceCurrentChapterPgn,
  selectedMove,
  selectFen,
  selectMove,
  toPgn,
  updateEvaluation,
  updateMoveCommentAfter,
  updateMoveCommentBefore,
  Context,
  applyNagToList,
  AppState,
  getNagGlyph,
  getNagMeaning,
  getPgn,
  Move,
  NormalizedPgn,
  Repertoire,
  normalizePgn,
  selectPreselectedVariation,
  setNagOnSelectedMove,
  spacebar,
} from "./AppState";
import { STARTING_FEN } from "./chess";

const ctx: Context = {
  type: "repertoire-builder",
  repertoireHandle: "white",
  chapterHandle: "chapter",
};

function testState(initialState: AppState): StoreState<AppState> {
  return createStore(initialState).state;
}

function fromPgn(pgn: string): StoreState<AppState> {
  const repertoire: Repertoire = {
    id: crypto.randomUUID(),
    handle: "white",
    name: "White",
    orientation: "white",
  };
  const chapter = {
    id: crypto.randomUUID(),
    repertoireId: repertoire.id,
    handle: "chapter",
    name: "Chapter",
    pgnId: crypto.randomUUID(),
  };
  return testState({
    ...emptyState(),
    pgns: { [chapter.pgnId]: { status: "success", data: normalizePgn(pgn) } },
    repertoires: {
      status: "success",
      data: { [repertoire.id]: repertoire },
    },
    chapters: { status: "success", data: { [chapter.id]: chapter } },
  });
}

function fromChapterPgns(chapterPgns: Record<string, string>): StoreState<AppState> {
  const repertoire: Repertoire = {
    id: crypto.randomUUID(),
    handle: "white",
    name: "White",
    orientation: "white",
  };
  const chapters = Object.fromEntries(
    Object.keys(chapterPgns).map((handle) => {
      const id = crypto.randomUUID();
      return [
        id,
        {
          id,
          repertoireId: repertoire.id,
          handle,
          name: handle,
          pgnId: crypto.randomUUID(),
        },
      ];
    }),
  );
  const pgns = Object.fromEntries(
    Object.values(chapters).map((chapter) => [
      chapter.pgnId,
      {
        status: "success" as const,
        data: normalizePgn(chapterPgns[chapter.handle]!),
      },
    ]),
  );

  return testState({
    ...emptyState(),
    pgns,
    repertoires: {
      status: "success",
      data: { [repertoire.id]: repertoire },
    },
    chapters: { status: "success", data: chapters },
  });
}

function normalizeFixturePgn(pgn: string): string {
  return pgn
    .split("\n")
    .filter((line) => !line.startsWith("[") && line.trim() !== "")
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s(1-0|0-1|1\/2-1\/2)\s*$/g, " *")
    .trim();
}

function moveCount(state: StoreState<AppState>): number {
  return Object.keys(getPgn(state, ctx)!.moves).length;
}

function getLoadedPgn(state: StoreState<AppState>, context: Context = ctx): NormalizedPgn {
  const pgn = getPgn(state, context);
  expect(pgn).not.toBeNull();
  return pgn as NormalizedPgn;
}

function findMove(pgn: NormalizedPgn, san: string): Move {
  const move = Object.values(pgn.moves).find((candidate) => candidate.san === san);
  expect(move).toBeDefined();
  return move as Move;
}

function expectValidPgnTree(pgn: NormalizedPgn): void {
  const reachable = new Set<number>();
  const rootIds = new Set(pgn.rootMoveIds);

  expect(rootIds.size).toBe(pgn.rootMoveIds.length);

  function visit(
    moveId: number,
    expectedPrev: number | null,
    expectedHalfMoveNumber: number,
  ): void {
    const move = pgn.moves[moveId];
    expect(move, `missing move ${moveId}`).toBeDefined();
    if (move === undefined) return;

    expect(reachable.has(moveId), `cycle or duplicate path at move ${moveId}`).toBe(false);
    reachable.add(moveId);
    expect(move.id).toBe(moveId);
    expect(move.prev).toBe(expectedPrev);
    expect(move.halfMoveNumber).toBe(expectedHalfMoveNumber);
    expect(new Set(move.next).size).toBe(move.next.length);

    for (const nextMoveId of move.next) {
      visit(nextMoveId, moveId, expectedHalfMoveNumber + 1);
    }
  }

  for (const rootMoveId of pgn.rootMoveIds) {
    visit(rootMoveId, null, 0);
  }

  for (const move of Object.values(pgn.moves)) {
    expect(reachable.has(move.id), `move ${move.id} is unreachable`).toBe(true);
    if (move.prev !== null) {
      const parent = pgn.moves[move.prev];
      expect(parent, `move ${move.id} has missing parent ${move.prev}`).toBeDefined();
      expect(parent?.next).toContain(move.id);
    }
  }

  expect(reachable.size).toBe(Object.keys(pgn.moves).length);
}

test("selected move is tracked per chapter", () => {
  const chapterOneCtx: Context = { ...ctx, chapterHandle: "chapter-1" };
  const chapterTwoCtx: Context = { ...ctx, chapterHandle: "chapter-2" };
  let state = fromChapterPgns({
    "chapter-1": "1. e4 e5 *",
    "chapter-2": "1. d4 d5 2. c4 *",
  });

  forward(state, chapterOneCtx);
  forward(state, chapterOneCtx);
  expect(selectedMove(state, chapterOneCtx)?.san).toBe("e5");

  expect(selectedMove(state, chapterTwoCtx)).toBeNull();
  forward(state, chapterTwoCtx);
  expect(selectedMove(state, chapterTwoCtx)?.san).toBe("d4");

  expect(selectedMove(state, chapterOneCtx)?.san).toBe("e5");
});

test("replacing PGN updates the current chapter only and clears its selection", () => {
  const chapterOneCtx: Context = { ...ctx, chapterHandle: "chapter-1" };
  const chapterTwoCtx: Context = { ...ctx, chapterHandle: "chapter-2" };
  const state = fromChapterPgns({
    "chapter-1": "1. e4 e5 *",
    "chapter-2": "1. d4 d5 *",
  });

  forward(state, chapterOneCtx);
  expect(selectedMove(state, chapterOneCtx)?.san).toBe("e4");

  replaceCurrentChapterPgn(state, chapterOneCtx, "1. c4 c5 2. Nc3 *");

  expect(selectedMove(state, chapterOneCtx)).toBeNull();
  expectValidPgnTree(getLoadedPgn(state, chapterOneCtx));
  expectValidPgnTree(getLoadedPgn(state, chapterTwoCtx));
  expect(toPgn(getLoadedPgn(state, chapterOneCtx))).toBe("1. c4 c5 2. Nc3 *");
  expect(toPgn(getLoadedPgn(state, chapterTwoCtx))).toBe("1. d4 d5 *");
});

test("updates move comments", () => {
  const state = fromPgn("1. d4 1... {Solid} d5 2. c4 {Queen's Gambit} e6 *");
  const pgn = getLoadedPgn(state);
  const d5 = findMove(pgn, "d5");
  const c4 = findMove(pgn, "c4");

  expect(d5.commentBefore).toBe("Solid");

  updateMoveCommentBefore(state, ctx, d5.id, "Updated before");
  expectValidPgnTree(getLoadedPgn(state));
  expect(toPgn(getLoadedPgn(state))).toBe(
    "1. d4 1... {Updated before} d5 2. c4 {Queen's Gambit} e6 *",
  );

  updateMoveCommentBefore(state, ctx, d5.id, "");
  expectValidPgnTree(getLoadedPgn(state));
  expect(toPgn(getLoadedPgn(state))).toBe("1. d4 d5 2. c4 {Queen's Gambit} e6 *");

  updateMoveCommentAfter(state, ctx, c4.id, "Updated comment");
  expectValidPgnTree(getLoadedPgn(state));
  expect(toPgn(getLoadedPgn(state))).toBe("1. d4 d5 2. c4 {Updated comment} e6 *");

  updateMoveCommentAfter(state, ctx, c4.id, "");
  expectValidPgnTree(getLoadedPgn(state));
  expect(toPgn(getLoadedPgn(state))).toBe("1. d4 d5 2. c4 e6 *");
});

test("preserves move NAGs when serializing", () => {
  const state = fromPgn("1. e4! $2 $9 e5 $2 2. Nf3 $19 $18 Nc6 *");
  const pgn = getPgn(state, ctx)!;
  const e4 = Object.values(pgn.moves).find((move) => move.san === "e4");
  const e5 = Object.values(pgn.moves).find((move) => move.san === "e5");
  const nf3 = Object.values(pgn.moves).find((move) => move.san === "Nf3");

  expect(e4?.nags).toEqual([2, 9]);
  expect(e5?.nags).toEqual([2]);
  expect(nf3?.nags).toEqual([18]);
  expect(toPgn(pgn)).toBe("1. e4 $2 $9 e5 $2 2. Nf3 $18 Nc6 *");
});

test("provides glyphs and meanings for NAGs up to 19", () => {
  expect(
    Array.from({ length: 19 }, (_, index) => {
      const nag = index + 1;
      return [nag, getNagGlyph(nag), getNagMeaning(nag)];
    }),
  ).toEqual([
    [1, "!", "Good move"],
    [2, "?", "Mistake"],
    [3, "!!", "Brilliant move"],
    [4, "??", "Blunder"],
    [5, "!?", "Interesting move"],
    [6, "?!", "Dubious move"],
    [7, "□", "Forced move"],
    [8, "□", "Singular move"],
    [9, "??", "Worst move"],
    [10, "=", "Position is equal"],
    [11, "=", "Equal chances, quiet position"],
    [12, "=", "Equal chances, active position"],
    [13, "∞", "Unclear position"],
    [14, "+=", "White has a slight advantage"],
    [15, "=+", "Black has a slight advantage"],
    [16, "+/-", "White has a moderate advantage"],
    [17, "-/+", "Black has a moderate advantage"],
    [18, "+-", "White is winning"],
    [19, "-+", "Black is winning"],
  ]);
});

test("applies NAG grouping rules", () => {
  expect([1, 9, 40].reduce((nags, nag) => applyNagToList(nags, nag), [] as number[])).toEqual([
    1, 9, 40,
  ]);
  expect([1, 2].reduce((nags, nag) => applyNagToList(nags, nag), [] as number[])).toEqual([2]);
  expect([18, 19].reduce((nags, nag) => applyNagToList(nags, nag), [] as number[])).toEqual([19]);
  expect([9, 9].reduce((nags, nag) => applyNagToList(nags, nag), [] as number[])).toEqual([]);
});

test("sets NAGs on the selected move", () => {
  const state = fromPgn("1. e4 e5 *");

  forward(state, ctx);
  expect(setNagOnSelectedMove(state, ctx, 1)).toBeUndefined();
  expectValidPgnTree(getLoadedPgn(state));
  expect(selectedMove(state, ctx)?.nags).toEqual([1]);

  setNagOnSelectedMove(state, ctx, 1);
  expectValidPgnTree(getLoadedPgn(state));
  expect(selectedMove(state, ctx)?.nags).toEqual([]);

  setNagOnSelectedMove(state, ctx, 1);
  setNagOnSelectedMove(state, ctx, 2);
  setNagOnSelectedMove(state, ctx, 9);
  expectValidPgnTree(getLoadedPgn(state));

  const move = selectedMove(state, ctx);
  expect(move?.nags).toEqual([2, 9]);
  expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 $2 $9 e5 *");
});

test("emits sound effects only when selecting a move", () => {
  const state = fromPgn("1. e4 d5 2. exd5 *");
  const pgn = getPgn(state, ctx)!;
  const e4 = pgn.rootMoveIds[0]!;
  const d5 = pgn.moves[e4]!.next[0]!;
  const exd5 = pgn.moves[d5]!.next[0]!;

  expect(selectMove(state, ctx, e4)).toEqual({ type: "play-sound", sound: "Move" });
  expect(selectMove(state, ctx, e4)).toBeUndefined();
  expect(setNagOnSelectedMove(state, ctx, 1)).toBeUndefined();
  expect(selectMove(state, ctx, exd5)).toEqual({ type: "play-sound", sound: "Capture" });
});

test("ignores stale engine evaluations", () => {
  const state = fromPgn("1. e4 e5 *");
  forward(state, ctx);
  const currentFen = selectFen(state, ctx);

  updateEvaluation(state, ctx, {
    index: 0,
    depth: 20,
    score: { type: "cp", value: 34 },
    pv: ["e2e4"],
    request: { fen: STARTING_FEN, depth: 20 },
  });
  updateEvaluation(state, ctx, {
    index: 0,
    depth: 20,
    score: { type: "cp", value: 34 },
    pv: ["e7e5"],
    request: { fen: currentFen, depth: 12 },
  });

  expect(state.evaluations).toEqual([]);

  updateEvaluation(state, ctx, {
    index: 0,
    depth: 20,
    score: { type: "cp", value: 34 },
    pv: ["e7e5"],
    request: { fen: currentFen, depth: 20 },
  });

  expect(state.evaluations).toHaveLength(1);
  expect(state.evaluations[0]?.score).toEqual({ type: "cp", value: -34 });
  expect(state.evaluations[0]?.moves[0]?.san).toBe("e5");
});

test("spacebar plays the best move in chapter editing", () => {
  const state = fromPgn("*");

  updateEvaluation(state, ctx, {
    index: 0,
    depth: 20,
    score: { type: "cp", value: 34 },
    pv: ["e2e4"],
    request: { fen: STARTING_FEN, depth: 20 },
  });

  spacebar(state, ctx);

  expect(selectedMove(state, ctx)?.san).toBe("e4");
  expect(toPgn(getLoadedPgn(state))).toBe("1. e4 *");
});

test("spacebar does not play the best move while training", () => {
  const trainingCtx: Context = {
    type: "variation-training",
    repertoireHandle: "white",
    chapterHandle: "chapter",
  };
  const state = fromPgn("*");

  updateEvaluation(state, trainingCtx, {
    index: 0,
    depth: 20,
    score: { type: "cp", value: 34 },
    pv: ["e2e4"],
    request: { fen: STARTING_FEN, depth: 20 },
  });

  spacebar(state, trainingCtx);

  expect(selectedMove(state, trainingCtx)).toBeNull();
  expect(Object.keys(state.training.variation.moves)).toHaveLength(0);
});

describe("delete move", () => {
  test("deleting last move should delete the move and select previous move", () => {
    let state = fromPgn("1. e4 e5 *");
    forward(state, ctx);
    forward(state, ctx);
    const move = selectedMove(state, ctx)!;
    expect(move.san).toBe("e5");
    deleteMove(state, ctx, move.id);
    expectValidPgnTree(getLoadedPgn(state));
    expect(selectedMove(state, ctx)?.san).toBe("e4");
    expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 *");
  });

  test("deleting first move should unselect selected move and remove root id", () => {
    let state = fromPgn("1. e4 e5 *");
    forward(state, ctx);
    const move = selectedMove(state, ctx)!;
    expect(move.san).toBe("e4");
    deleteMove(state, ctx, move.id);
    expectValidPgnTree(getLoadedPgn(state));
    expect(selectedMove(state, ctx)).toBeNull();
    expect(getPgn(state, ctx)?.rootMoveIds).toHaveLength(0);
  });

  test("deleting move should delete descendants", () => {
    let state = fromPgn("1. e4 e5 *");
    forward(state, ctx);
    // Create a variation
    moveFromChessboard(state, ctx, "e7", "e6", "bP");
    back(state, ctx);
    const firstMove = selectedMove(state, ctx)!;
    deleteMove(state, ctx, firstMove.id);
    expectValidPgnTree(getLoadedPgn(state));
    expect(selectedMove(state, ctx)).toBeNull();
    expect(getPgn(state, ctx)?.rootMoveIds).toHaveLength(0);
    expect(Object.keys(getPgn(state, ctx)!.moves).length).toBe(0);
  });
});

describe("arrow down", () => {
  test("should preselect variation", () => {
    let state = fromPgn("1. e4 e5 (1... d6) *");
    forward(state, ctx);
    expect(selectedMove(state, ctx)?.san).toBe("e4");
    arrowDown(state, ctx);
    const preselectedVariation = selectPreselectedVariation(state, ctx);
    expect(getPgn(state, ctx)?.moves[preselectedVariation!]?.san).toBe("d6");
    forward(state, ctx);
    expect(selectedMove(state, ctx)?.san).toBe("d6");
  });

  test("should preselect root move variations if multiple root moves", () => {
    let state = fromPgn("1. e4 (1. f4) (1. d4 Nf6) *");
    arrowDown(state, ctx);
    const preselectedVariation = selectPreselectedVariation(state, ctx);
    expect(getPgn(state, ctx)?.moves[preselectedVariation!]?.san).toBe("f4");
  });
});

describe("forward", () => {
  test("when preselected variation exists on root move should select it", () => {
    let state = fromPgn("1. e4 (1. f4) (1. d4 Nf6) *");
    arrowDown(state, ctx);
    forward(state, ctx);
    expect(selectedMove(state, ctx)?.san).toBe("f4");
  });
});

test.skip("empty state + move", () => {
  const state = testState(emptyState());

  moveFromChessboard(state, ctx, "e2", "e4", "wP");
  expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 *");
});

test("forward when not move is selected should select first root move", () => {
  let state = fromPgn("1. e4 e5");
  expect(forward(state, ctx)).toEqual({ type: "play-sound", sound: "Move" });
  expect(selectedMove(state, ctx)?.san).toBe("e4");
});

test("forward on the last move should do nothing", () => {
  let state = fromPgn("1. e4");
  forward(state, ctx);
  expect(selectedMove(state, ctx)?.san).toBe("e4");
  forward(state, ctx);
  expect(selectedMove(state, ctx)?.san).toBe("e4");
});

test("forward and back on main line", () => {
  let state = fromPgn("1. e4 e5");
  selectMove(state, ctx, getPgn(state, ctx)!.rootMoveIds[0]!);
  forward(state, ctx);
  expect(selectedMove(state, ctx)?.san).toBe("e5");
  back(state, ctx);
  expect(selectedMove(state, ctx)?.san).toBe("e4");
});

test("move on main line", () => {
  let state = fromPgn("1. e4");
  forward(state, ctx);
  moveFromChessboard(state, ctx, "e7", "e5", "bP");
  expectValidPgnTree(getLoadedPgn(state));
  expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 e5 *");
});

test("move should create variation", () => {
  let state = fromPgn("1. e4 e5 *");
  forward(state, ctx);
  moveFromChessboard(state, ctx, "e7", "e6", "bP");
  expectValidPgnTree(getLoadedPgn(state));
  expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 e5 (1... e6) *");
});

test("making a move that already exists should not create variation", () => {
  let state = fromPgn("1. e4 e5 *");
  forward(state, ctx);
  moveFromChessboard(state, ctx, "e7", "e5", "bP");
  expectValidPgnTree(getLoadedPgn(state));
  expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 e5 *");
});

test("making a top move that already exists should not create variation", () => {
  let state = fromPgn("1. e4 e5 *");
  moveFromChessboard(state, ctx, "e2", "e4", "wP");
  expectValidPgnTree(getLoadedPgn(state));
  expect(selectedMove(state, ctx)?.san).toBe("e4");
  expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 e5 *");
});

test.each([
  "complex.pgn",
  "magnus-vs-hikaru.pgn",
  "shortest-stalemate.pgn",
  "vienna-copycat.pgn",
  "vienna-with-variations.pgn",
])("parses, serializes, and reparses %s", async (fileName) => {
  const pgn = await fs.readFile(`./pgns/${fileName}`, "utf-8");
  const state = fromPgn(pgn);
  expectValidPgnTree(getLoadedPgn(state));
  const serialized = toPgn(getLoadedPgn(state));
  const reparsedState = fromPgn(serialized);
  expectValidPgnTree(getLoadedPgn(reparsedState));

  expect(moveCount(reparsedState)).toBe(moveCount(state));
  expect(getPgn(reparsedState, ctx)!.rootMoveIds).toHaveLength(
    getPgn(state, ctx)!.rootMoveIds.length,
  );
});

test("preserves serializer output for the primary variation fixture", async () => {
  const pgn = await fs.readFile("./pgns/vienna-with-variations.pgn", "utf-8");
  const state = fromPgn(pgn);

  expectValidPgnTree(getLoadedPgn(state));
  expect(toPgn(getLoadedPgn(state))).toBe(normalizeFixturePgn(pgn));
});

test("back on root move should unselect first move", () => {
  let state = fromPgn("1. e4 e5 *");
  forward(state, ctx);
  back(state, ctx);
  expect(selectedMove(state, ctx)).toBeNull();
});

test("arrow down on a move without variation should go to the next move", () => {
  let state = fromPgn("1. e4 e5 *");
  arrowDown(state, ctx);
  expect(selectedMove(state, ctx)?.san).toBe("e5");
});

test("arrow up on a move without variation should unselect move", () => {
  let state = fromPgn("1. e4 e5 *");
  arrowDown(state, ctx);
  arrowUp(state, ctx);
  expect(selectedMove(state, ctx)).toBeNull();
});

test("multi root moves", () => {
  let state = fromPgn("1. e4 (1. f4) (1. d4 Nf6) *");
  const pgn = getPgn(state, ctx)!;
  expectValidPgnTree(pgn);
  expect(getPgn(state, ctx)?.rootMoveIds).toHaveLength(3);
  expect(pgn.moves[pgn.rootMoveIds[0]!]?.san).toBe("e4");
  expect(pgn.moves[pgn.rootMoveIds[1]!]?.san).toBe("f4");
  expect(pgn.moves[pgn.rootMoveIds[2]!]?.san).toBe("d4");
});

describe("promote variation", () => {
  test("promote variation from top move of the variation", () => {
    let state = fromPgn("1. e4 e5 (1... d6) *");
    const d6Move = Array.from(Object.values(getPgn(state, ctx)!.moves)).find(
      (move) => move.san === "d6",
    );

    promoteVariation(state, ctx, d6Move!.id);
    expectValidPgnTree(getLoadedPgn(state));

    expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 d6 (1... e5) *");
  });

  test("promote variation from last move of the variation", () => {
    let state = fromPgn("1. e4 e5 (1... d6 2. c4) *");
    const c4Move = Array.from(Object.values(getPgn(state, ctx)!.moves)).find(
      (move) => move.san === "c4",
    );

    promoteVariation(state, ctx, c4Move!.id);
    expectValidPgnTree(getLoadedPgn(state));

    expect(toPgn(getPgn(state, ctx)!)).toBe("1. e4 d6 (1... e5) 2. c4 *");
  });

  test("promote variation from the root", () => {
    let state = fromPgn("1. e4 (1. Nf3 Nf6) 1... e5 *");
    const nf6Move = Array.from(Object.values(getPgn(state, ctx)!.moves)).find(
      (move) => move.san === "Nf6",
    );

    promoteVariation(state, ctx, nf6Move!.id);
    expectValidPgnTree(getLoadedPgn(state));

    expect(toPgn(getPgn(state, ctx)!)).toBe("1. Nf3 (1. e4 e5) 1... Nf6 *");
  });
});
