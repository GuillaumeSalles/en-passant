import { describe, expect, test, vi } from "vitest";
import { emptyState, normalizePgn, trainingLineReviewKey } from "@/lib/AppState";
import { createStore } from "@/lib/createStore";
import { applyRecordChangesToState } from "./recordChangeSync";

function loadedStore() {
  const store = createStore(emptyState());
  store.state.set("repertoires", {
    status: "success",
    data: {
      old: { id: "old", handle: "old", name: "Old", orientation: "white" },
    },
  });
  store.state.set("chapters", {
    status: "success",
    data: {
      old: {
        id: "old",
        repertoireId: "old",
        handle: "old",
        name: "Old",
        pgnId: "old-pgn",
      },
    },
  });
  store.state.set("pgns", {
    "changed-pgn": { status: "success", data: normalizePgn("1. d4 d5 *") },
    "deleted-pgn": { status: "success", data: normalizePgn("1. e4 e5 *") },
  });
  return store;
}

describe("record change state sync", () => {
  test("re-reads changed records from IndexedDB and replaces loaded state", async () => {
    const store = loadedStore();
    const schedule = {
      repertoireId: "repertoire-1",
      chapterId: "chapter-1",
      uciPath: "e2e4/e7e5",
      intervalIndex: 1,
      dueAt: 200,
      lastReviewedAt: 100,
      algorithmVersion: 1,
    };
    const reads = {
      getAllRepertoires: vi.fn(async () => [
        {
          id: "repertoire-1",
          handle: "sicilian",
          name: "Sicilian",
          orientation: "black" as const,
        },
      ]),
      getAllChapters: vi.fn(async () => [
        {
          id: "chapter-1",
          repertoireId: "repertoire-1",
          handle: "najdorf",
          name: "Najdorf",
          pgnId: "changed-pgn",
        },
      ]),
      getAllTrainingLineSchedules: vi.fn(async () => [schedule]),
      getPgn: vi.fn(async (id: string) => (id === "changed-pgn" ? "1. e4 c5 *" : undefined)),
    };

    await applyRecordChangesToState(
      store.state,
      [
        { kind: "repertoire", id: "repertoire-1" },
        { kind: "chapter", id: "chapter-1" },
        { kind: "training-line-schedule", id: "schedule-1" },
        { kind: "pgn", id: "changed-pgn" },
        { kind: "pgn", id: "deleted-pgn" },
      ],
      reads,
    );

    expect(store.state.repertoires.data).toEqual({
      "repertoire-1": {
        id: "repertoire-1",
        handle: "sicilian",
        name: "Sicilian",
        orientation: "black",
      },
    });
    expect(store.state.chapters.data).toEqual({
      "chapter-1": {
        id: "chapter-1",
        repertoireId: "repertoire-1",
        handle: "najdorf",
        name: "Najdorf",
        pgnId: "changed-pgn",
      },
    });
    expect(store.state.training.reviews).toEqual({
      [trainingLineReviewKey("repertoire-1", "chapter-1", "e2e4/e7e5")]: schedule,
    });
    expect(store.state.pgns["changed-pgn"]?.data).toEqual(normalizePgn("1. e4 c5 *"));
    expect(store.state.pgns["deleted-pgn"]).toBeUndefined();
  });

  test("does not load PGNs that are not already projected into this tab", async () => {
    const store = loadedStore();
    const getPgn = vi.fn(async () => "1. c4 e5 *");

    await applyRecordChangesToState(store.state, [{ kind: "pgn", id: "not-loaded-pgn" }], {
      getAllRepertoires: vi.fn(async () => []),
      getAllChapters: vi.fn(async () => []),
      getAllTrainingLineSchedules: vi.fn(async () => []),
      getPgn,
    });

    expect(getPgn).not.toHaveBeenCalled();
    expect(store.state.pgns["not-loaded-pgn"]).toBeUndefined();
  });
});
