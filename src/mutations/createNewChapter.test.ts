import { describe, expect, test } from "vitest";
import { AppState, Chapter, emptyNormalizedPgn, toPgn } from "@/lib/AppState";
import { createMutationContext } from "@/tests/mocks";
import { chapterStub, repertoireStub } from "@/tests/stubs";
import { createNewChapter } from "./createNewChapter";

function getChaptersOrThrow(state: AppState): Chapter[] {
  if (state.chapters.status !== "success") {
    throw new Error("Chapters are not loaded");
  }
  return Object.values(state.chapters.data);
}

describe("createNewChapter", () => {
  test("creates a chapter and PGN for the selected repertoire", async () => {
    const repertoire = repertoireStub({
      id: "repertoire-id",
      handle: "white-repertoire",
    });
    const context = createMutationContext({
      repertoires: {
        status: "success",
        data: { [repertoire.id]: repertoire },
      },
    });

    await createNewChapter(context, { repertoireId: repertoire.id });

    const chapters = getChaptersOrThrow(context.store.state);
    const newChapter = chapters[0]!;
    expect(newChapter.name).toBe("Chapter 1");
    expect(newChapter.handle).toBe("chapter-1");
    expect(newChapter.repertoireId).toBe(repertoire.id);
    expect(context.store.state.pgns[newChapter.pgnId]?.data?.moves).toEqual({});
  });

  test("creates a chapter from a PGN", async () => {
    const repertoire = repertoireStub({
      id: "repertoire-id",
      handle: "white-repertoire",
    });
    const context = createMutationContext({
      repertoires: {
        status: "success",
        data: { [repertoire.id]: repertoire },
      },
    });

    await createNewChapter(context, {
      repertoireId: repertoire.id,
      pgn: "1. d4 d5 2. c4 {Queen's Gambit} e6 *",
    });

    const chapters = getChaptersOrThrow(context.store.state);
    const newChapter = chapters[0]!;
    const pgn = context.store.state.pgns[newChapter.pgnId]?.data;
    expect(pgn === undefined ? undefined : toPgn(pgn)).toBe("1. d4 d5 2. c4 {Queen's Gambit} e6 *");
    expect(context.storage.createChapter).toHaveBeenCalledTimes(1);
    expect(context.storage.createChapter.mock.calls[0]?.[1]).toBe(
      "1. d4 d5 2. c4 {Queen's Gambit} e6 *",
    );
  });

  test("preserves existing chapters and increments the chapter name", async () => {
    const repertoire = repertoireStub({ id: "repertoire-id" });
    const existingChapter = chapterStub({
      id: "chapter-id",
      repertoireId: repertoire.id,
      handle: "chapter-1",
      name: "Chapter 1",
      pgnId: "pgn-id",
    });
    const context = createMutationContext({
      repertoires: {
        status: "success",
        data: { [repertoire.id]: repertoire },
      },
      chapters: {
        status: "success",
        data: { [existingChapter.id]: existingChapter },
      },
      pgns: {
        [existingChapter.pgnId]: {
          status: "success",
          data: emptyNormalizedPgn(),
        },
      },
    });

    await createNewChapter(context, { repertoireId: repertoire.id });

    const chapters = getChaptersOrThrow(context.store.state);
    const newChapter = chapters.find((chapter) => chapter.id !== existingChapter.id)!;
    expect(context.store.state.chapters.data![existingChapter.id]).toEqual(existingChapter);
    expect(newChapter.name).toBe("Chapter 2");
    expect(newChapter.handle).toBe("chapter-2");
  });

  test("keeps the chapter handle unique when the next handle already exists", async () => {
    const repertoire = repertoireStub({ id: "repertoire-id" });
    const existingChapters = [
      chapterStub({ id: "1", repertoireId: repertoire.id, handle: "chapter-1" }),
      chapterStub({ id: "2", repertoireId: repertoire.id, handle: "chapter-3" }),
    ];
    const context = createMutationContext({
      repertoires: {
        status: "success",
        data: { [repertoire.id]: repertoire },
      },
      chapters: {
        status: "success",
        data: Object.fromEntries(existingChapters.map((chapter) => [chapter.id, chapter])),
      },
    });

    await createNewChapter(context, { repertoireId: repertoire.id });

    const chapters = getChaptersOrThrow(context.store.state);
    const newChapter = chapters.find(
      (chapter) => !existingChapters.some((existing) => existing.id === chapter.id),
    )!;
    expect(newChapter.name).toBe("Chapter 3");
    expect(newChapter.handle).toBe("chapter-3-1");
  });

  test("saves to storage", async () => {
    const repertoire = repertoireStub({ id: "repertoire-id" });
    const context = createMutationContext({
      repertoires: {
        status: "success",
        data: { [repertoire.id]: repertoire },
      },
    });

    await createNewChapter(context, { repertoireId: repertoire.id });

    expect(context.storage.createChapter).toHaveBeenCalledTimes(1);
    const [chapter, pgn] = context.storage.createChapter.mock.calls[0]!;
    expect(chapter.name).toBe("Chapter 1");
    expect(chapter.repertoireId).toBe(repertoire.id);
    expect(pgn).toBe("");
  });

  test("navigates to the created chapter route", async () => {
    const repertoire = repertoireStub({
      id: "repertoire-id",
      handle: "black-repertoire",
    });
    const context = createMutationContext({
      repertoires: {
        status: "success",
        data: { [repertoire.id]: repertoire },
      },
    });

    await createNewChapter(context, { repertoireId: repertoire.id });

    expect(context.router.push).toHaveBeenCalledWith("/app/repertoires/black-repertoire/chapter-1");
  });

  test("does nothing when the repertoire no longer exists", async () => {
    const context = createMutationContext();

    await createNewChapter(context, { repertoireId: "missing-repertoire" });

    expect(getChaptersOrThrow(context.store.state)).toEqual([]);
    expect(context.storage.createChapter).not.toHaveBeenCalled();
    expect(context.router.push).not.toHaveBeenCalled();
  });
});
