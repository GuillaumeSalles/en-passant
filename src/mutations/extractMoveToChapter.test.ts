import { beforeEach, describe, expect, test, vi } from "vitest";
import { getChapterPgn, normalizePgn, toPgn, updateMoveCommentAfter } from "@/lib/AppState";
import { MAX_CHAPTERS_PER_REPERTOIRE } from "@/lib/repertoireLimits";
import { createMutationContext } from "@/tests/mocks";
import { chapterStub, repertoireStub } from "@/tests/stubs";
import { saveLatestPgnMutation } from "@/storage/pgnPersistence";
import { extractMoveToChapter } from "./extractMoveToChapter";

vi.mock("@/storage/pgnPersistence", () => ({ saveLatestPgnMutation: vi.fn() }));

const sourcePgn = "1. e4 e5 (1... c5 $5 {Sicilian} 2. Nf3 d6 (2... Nc6)) 2. Bc4 *";
const repertoire = repertoireStub({ id: "repertoire", handle: "white" });
const chapter = chapterStub({
  id: "chapter",
  repertoireId: repertoire.id,
  handle: "chapter-1",
  pgnId: "pgn",
});

function setup(pgn = sourcePgn) {
  const context = createMutationContext(
    {
      repertoires: { status: "success", data: { [repertoire.id]: repertoire } },
      chapters: { status: "success", data: { [chapter.id]: chapter } },
      pgns: { [chapter.pgnId]: { status: "success", data: normalizePgn(pgn) } },
    },
    { type: "repertoire-builder", repertoireHandle: "white", chapterHandle: "chapter-1" },
  );
  const source = getChapterPgn(context.state, context.route)!;
  const move = Object.values(source.moves).find((candidate) => candidate.san === "c5")!;
  return { context, source, move };
}

beforeEach(() => vi.clearAllMocks());

describe("extractMoveToChapter", () => {
  test("saves the branch in a new chapter and persists its removal from the source", async () => {
    const { context, source, move } = setup();

    await extractMoveToChapter(context, move.id);

    const [created, pgn] = context.storage.createChapter.mock.calls[0]!;
    expect(created).toMatchObject({
      repertoireId: repertoire.id,
      name: "Chapter 2",
      handle: "chapter-2",
    });
    expect(pgn).toBe("1. e4 c5 $5 {Sicilian} 2. Nf3 d6 (2... Nc6) *");
    expect(toPgn(context.state.pgns[created.pgnId]!.data!)).toBe(pgn);
    expect(toPgn(source)).toBe("1. e4 e5 2. Bc4 *");
    expect(saveLatestPgnMutation).toHaveBeenCalledExactlyOnceWith(
      chapter.pgnId,
      "1. e4 e5 2. Bc4 *",
      { type: "deleteSubtree", path: ["e2e4", "c7c5"] },
    );
    expect(context.router.push).toHaveBeenCalledWith("/app/repertoires/white/chapter-2");
  });

  test("waits for the new chapter to be saved before removing the original moves", async () => {
    const { context, source, move } = setup();
    let finishSave: () => void = () => {};
    context.storage.createChapter.mockReturnValue(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    );

    const extraction = extractMoveToChapter(context, move.id);
    expect(toPgn(source)).toBe(sourcePgn);
    expect(saveLatestPgnMutation).not.toHaveBeenCalled();
    finishSave();
    await extraction;

    expect(toPgn(source)).toBe("1. e4 e5 2. Bc4 *");
  });

  test("keeps the original moves when saving the chapter fails", async () => {
    const { context, source, move } = setup();
    context.storage.createChapter.mockRejectedValue(new Error("Storage unavailable"));

    await expect(extractMoveToChapter(context, move.id)).rejects.toThrow("Storage unavailable");

    expect(toPgn(source)).toBe(sourcePgn);
    expect(saveLatestPgnMutation).not.toHaveBeenCalled();
  });

  test.each(["edit", "replace", "delete"])(
    "keeps source changes made during chapter creation: %s",
    async (change) => {
      const { context, source, move } = setup();
      const extraction = extractMoveToChapter(context, move.id);
      if (change === "edit") {
        updateMoveCommentAfter(context.state, context.route, move.id, "Updated while saving");
      } else if (change === "replace") {
        context.state.set("pgns", {
          [chapter.pgnId]: { status: "success", data: normalizePgn("1. d4 d5 *") },
        });
      } else {
        context.state.set("chapters", { status: "success", data: {} });
      }

      await extraction;

      expect(source.moves[move.id]).toBeDefined();
      expect(saveLatestPgnMutation).not.toHaveBeenCalled();
      if (change === "edit")
        expect(source.moves[move.id]?.commentAfter).toBe("Updated while saving");
      if (change === "replace")
        expect(toPgn(getChapterPgn(context.state, context.route)!)).toBe("1. d4 d5 *");
    },
  );

  test("does not remove moves when the repertoire already has twenty chapters", async () => {
    const { context, source, move } = setup();
    const chapters = Array.from({ length: MAX_CHAPTERS_PER_REPERTOIRE - 1 }, (_, index) =>
      chapterStub({ id: `other-${index}`, repertoireId: repertoire.id }),
    );
    context.state.set("chapters", {
      status: "success",
      data: {
        [chapter.id]: chapter,
        ...Object.fromEntries(chapters.map((entry) => [entry.id, entry])),
      },
    });

    await extractMoveToChapter(context, move.id);

    expect(toPgn(source)).toBe(sourcePgn);
    expect(context.storage.createChapter).not.toHaveBeenCalled();
    expect(context.router.push).not.toHaveBeenCalled();
    expect(saveLatestPgnMutation).not.toHaveBeenCalled();
  });

  test.each(["repertoire", "chapter", "pgn", "move"])("ignores a missing %s", async (missing) => {
    const { context, source, move } = setup();
    if (missing === "repertoire") context.state.set("repertoires", { status: "success", data: {} });
    if (missing === "chapter") context.state.set("chapters", { status: "success", data: {} });
    if (missing === "pgn") context.state.set("pgns", {});

    await extractMoveToChapter(context, missing === "move" ? -1 : move.id);

    expect(toPgn(source)).toBe(sourcePgn);
    expect(context.storage.createChapter).not.toHaveBeenCalled();
    expect(context.router.push).not.toHaveBeenCalled();
    expect(saveLatestPgnMutation).not.toHaveBeenCalled();
  });

  test("does not extract from training mode", async () => {
    const { context, source, move } = setup();
    context.route = { ...context.route, type: "variation-training" };

    await extractMoveToChapter(context, move.id);

    expect(toPgn(source)).toBe(sourcePgn);
    expect(context.storage.createChapter).not.toHaveBeenCalled();
    expect(saveLatestPgnMutation).not.toHaveBeenCalled();
  });
});
