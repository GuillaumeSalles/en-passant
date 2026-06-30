import { describe, test, expect } from "vitest";
import { createNewRepertoire } from "./createNewRepertoire";
import { AppState, Repertoire, emptyNormalizedPgn } from "@/lib/AppState";
import { createMutationContext } from "@/tests/mocks";
import { chapterStub, repertoireStub } from "@/tests/stubs";
import { MAX_REPERTOIRE_NAME_LENGTH } from "@/lib/repertoireNames";

const defaultInput = {
  name: "Untitled Repertoire",
  orientation: "white" as const,
};

function getRepertoiresOrThrow(state: AppState): Repertoire[] {
  if (state.repertoires.status !== "success") {
    throw new Error("Repertoires are not loaded");
  }
  return Object.values(state.repertoires.data);
}

describe("createNewRepertoire", () => {
  describe("getNextValidRepertoireHandle", () => {
    test("returns 'untitled-repertoire' when no repertoires exist", async () => {
      const context = createMutationContext();
      await createNewRepertoire(context, defaultInput);
      const repertoires = getRepertoiresOrThrow(context.store.state);
      expect(repertoires[0]!.handle).toBe("untitled-repertoire");
    });

    test("uses a clean handle from the repertoire name", async () => {
      const context = createMutationContext();
      await createNewRepertoire(context, {
        name: "French Defense",
        orientation: "black",
      });
      const repertoires = getRepertoiresOrThrow(context.store.state);
      expect(repertoires[0]!.handle).toBe("french-defense");
    });

    test("increments handle when existing handles conflict", async () => {
      const existing = repertoireStub({
        id: "1",
        handle: "untitled-repertoire",
        name: "Existing",
      });
      const context = createMutationContext({
        repertoires: {
          status: "success",
          data: { [existing.id]: existing },
        },
      });

      await createNewRepertoire(context, defaultInput);
      const repertoires = getRepertoiresOrThrow(context.store.state);
      const newRepertoire = repertoires.find((r) => r !== existing)!;
      expect(newRepertoire.handle).toBe("untitled-repertoire-1");
    });

    test("finds first available handle gap", async () => {
      const existing = [
        repertoireStub({ id: "1", handle: "untitled-repertoire" }),
        repertoireStub({ id: "2", handle: "untitled-repertoire-1" }),
        repertoireStub({ id: "3", handle: "untitled-repertoire-3" }),
      ];
      const context = createMutationContext({
        repertoires: {
          status: "success",
          data: Object.fromEntries(existing.map((r) => [r.id, r])),
        },
      });

      await createNewRepertoire(context, defaultInput);
      const repertoires = getRepertoiresOrThrow(context.store.state);
      const newRepertoire = repertoires.find((r) => !existing.some((e) => e.id === r.id))!;
      expect(newRepertoire.handle).toBe("untitled-repertoire-2");
    });
  });

  describe("createNewRepertoire", () => {
    test("creates repertoire, chapter, and PGN", async () => {
      const context = createMutationContext();
      await createNewRepertoire(context, {
        name: "Black Repertoire",
        orientation: "black",
      });
      const state = context.store.state;

      const repertoires = getRepertoiresOrThrow(state);
      const newRepertoire = repertoires[0]!;
      expect(newRepertoire.name).toBe("Black Repertoire");
      expect(newRepertoire.orientation).toBe("black");

      const newChapter = Object.values(state.chapters.data!)[0]!;
      expect(newChapter.name).toBe("Chapter 1");
      expect(newChapter.repertoireId).toBe(newRepertoire.id);

      const pgn = state.pgns[newChapter.pgnId]!;
      expect(pgn.data?.moves).toEqual({});
    });

    test("preserves existing data", async () => {
      const existingRepertoire = repertoireStub({
        id: "existing-id",
        handle: "existing",
        name: "Existing",
      });
      const existingChapter = chapterStub({
        id: "chapter-id",
        repertoireId: "existing-id",
        handle: "chapter",
        name: "Chapter",
        pgnId: "pgn-id",
      });

      const context = createMutationContext({
        repertoires: {
          status: "success",
          data: { [existingRepertoire.id]: existingRepertoire },
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

      await createNewRepertoire(context, defaultInput);
      const state = context.store.state;

      const repertoires = getRepertoiresOrThrow(state);
      expect(repertoires.find((r) => r.id === existingRepertoire.id)).toEqual(existingRepertoire);
      expect(repertoires).toHaveLength(2);
      expect(state.chapters.data![existingChapter.id]).toEqual(existingChapter);
    });

    test("saves to storage", async () => {
      const context = createMutationContext();
      await createNewRepertoire(context, {
        name: "Queen Pawn",
        orientation: "black",
      });
      expect(context.storage.createRepertoireAndChapter).toHaveBeenCalledTimes(1);
      const [repertoire, chapter, pgn] = context.storage.createRepertoireAndChapter.mock.calls[0]!;
      expect(repertoire.name).toBe("Queen Pawn");
      expect(repertoire.orientation).toBe("black");
      expect(chapter.name).toBe("Chapter 1");
      expect(chapter.repertoireId).toBe(repertoire.id);
      expect(pgn).toBe("");
    });

    test("limits created repertoire names before saving", async () => {
      const context = createMutationContext();
      await createNewRepertoire(context, {
        name: "A".repeat(MAX_REPERTOIRE_NAME_LENGTH + 1),
        orientation: "white",
      });

      const [repertoire] = context.storage.createRepertoireAndChapter.mock.calls[0]!;
      expect(repertoire.name).toHaveLength(MAX_REPERTOIRE_NAME_LENGTH);
    });

    test("navigates to new repertoire route", async () => {
      const context = createMutationContext();
      await createNewRepertoire(context, defaultInput);
      expect(context.router.push).toHaveBeenCalledWith(
        "/app/repertoires/untitled-repertoire/chapter-1",
      );
    });

    test("navigates with incremented handle when needed", async () => {
      const existing = repertoireStub({
        id: "1",
        handle: "untitled-repertoire",
      });
      const context = createMutationContext({
        repertoires: {
          status: "success",
          data: { [existing.id]: existing },
        },
      });
      await createNewRepertoire(context, defaultInput);
      expect(context.router.push).toHaveBeenCalledWith(
        "/app/repertoires/untitled-repertoire-1/chapter-1",
      );
    });

    test("generates unique IDs", async () => {
      const context = createMutationContext();
      await createNewRepertoire(context, defaultInput);
      const state = context.store.state;
      const repertoire = getRepertoiresOrThrow(state)[0]!;
      const chapter = Object.values(state.chapters.data!)[0]!;
      expect(repertoire.id).not.toBe(chapter.id);
      expect(chapter.id).not.toBe(chapter.pgnId);
    });
  });
});
