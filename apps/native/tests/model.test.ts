import { describe, expect, it, vi } from "vitest";
import { NativeModel, type Persistence } from "../src/model";
import { selectMove, setNagOnSelectedMove, updateMoveCommentAfter } from "@/lib/AppState";
import type { RepertoireSyncResponse } from "@/storage/contracts";

async function fixture(pgn = "1. e4 e5 2. Nf3 *") {
  let saved: string | null = null;
  let id = 0;
  const persistence: Persistence = {
    read: async () => saved,
    write: async (value) => {
      saved = value;
    },
  };
  const model = new NativeModel(persistence, () => `native-${++id}`);
  await model.initialize();
  model.createRepertoire("Test", "white", pgn);
  await model.flush();
  return { model, persistence, id: () => `native-${++id}` };
}
function emptyResponse(): RepertoireSyncResponse {
  return {
    cursor: new Date().toISOString(),
    acknowledgedPgn: null,
    changes: { repertoires: [], chapters: [], pgns: [], trainingLineSchedules: [] },
  };
}

describe("native shared chess controller", () => {
  it("round trips move edits, NAGs and comments using the web PGN implementation", async () => {
    const { model, persistence, id } = await fixture();
    model.play("d2", "d4");
    const selected = model.selected;
    if (selected === null) throw new Error("Move should be selected");
    model.command((state, ctx) => setNagOnSelectedMove(state, ctx, 1));
    model.command((state, ctx) => updateMoveCommentAfter(state, ctx, selected.id, "Central space"));
    expect(model.exportPgn()).toContain("d4 $1 {Central space}");
    await model.flush();
    const restored = new NativeModel(persistence, id);
    await restored.initialize();
    restored.openChapter(model.chapterId ?? "");
    expect(restored.exportPgn()).toBe(model.exportPgn());
  });
  it("retains each chapter selection and safely handles deleted chapter ids", async () => {
    const { model } = await fixture();
    const chapter = model.chapter;
    if (chapter === null) throw new Error("Missing chapter");
    model.command((state, ctx) => selectMove(state, ctx, model.pgn?.rootMoveIds[0] ?? -1));
    model.createChapter(chapter.repertoireId, "Other", "1. d4 *");
    expect(model.selected).toBeNull();
    model.openChapter(chapter.id);
    expect(model.selected?.san).toBe("e4");
    model.delete("chapter", chapter.id);
    model.openChapter(chapter.id);
    expect(model.chapter?.id).not.toBe(chapter.id);
    expect(() => model.play("e2", "e4")).not.toThrow();
  });
  it("requires legal moves and saves training after failed moves are repeated", async () => {
    const { model } = await fixture();
    const line = model.lines[0];
    if (line === undefined) throw new Error("Missing line");
    model.startTraining(line, false);
    model.play("d2", "d5");
    expect(model.attempt?.mistakes).toBe(0);
    model.play("d2", "d4");
    model.play("e2", "e4");
    model.play("g1", "f3");
    expect(model.review(line)).toBeUndefined();
    for (let index = 0; index < 3; index++) model.play("e2", "e4");
    expect(model.attempt?.phase).toBe("complete");
    expect(model.attempt?.mistakes).toBe(1);
    expect(model.review(line)?.intervalIndex).toBe(0);
  });
  it("rejects malformed imports without changing the library", async () => {
    const { model } = await fixture();
    const original = model.exportPgn();
    expect(() => model.importPgn("1. e5 *")).toThrow();
    expect(model.exportPgn()).toBe(original);
  });
});

describe("native persistence and account boundary", () => {
  it("preserves anonymous data but clears authenticated data on sign-out and user changes", async () => {
    const { model, persistence, id } = await fixture();
    await model.setOwner(null);
    expect(model.repertoires).toHaveLength(2);
    await model.setOwner("alice");
    await model.setOwner("bob");
    expect(model.repertoires).toEqual([]);
    model.createRepertoire("Bob", "black");
    await model.setOwner(null);
    expect(model.chapters).toEqual([]);
    const restored = new NativeModel(persistence, id);
    await restored.initialize();
    expect(restored.repertoires).toEqual([]);
  });
  it("serializes writes so a late old write cannot restore signed-out data", async () => {
    const { model, persistence } = await fixture();
    await model.setOwner("alice");
    const writes: string[] = [];
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(persistence, "write")
      .mockImplementationOnce(async (value) => {
        await gate;
        writes.push(value);
      })
      .mockImplementation(async (value) => {
        writes.push(value);
      });
    model.createRepertoire("Private", "white");
    const cleared = model.setOwner(null);
    release();
    await cleared;
    expect(JSON.parse(writes.at(-1) ?? "{}").repertoires).toEqual([]);
  });
  it("does not acknowledge concurrent metadata edits even within the same millisecond", async () => {
    const { model } = await fixture();
    const request = model.syncRequest();
    const record = model.data.repertoires[0];
    if (record === undefined) throw new Error("Missing repertoire");
    record.name = "Changed while syncing";
    model.applySync(emptyResponse(), request);
    expect(model.data.repertoires[0]?.dirty).toBe(true);
    expect(model.data.repertoires[0]?.name).toBe("Changed while syncing");
  });
  it("acknowledges only uploaded PGN mutations, retaining moves made during sync", async () => {
    const { model } = await fixture();
    const request = model.syncRequest();
    const sent = request.changes.pgns[0];
    if (sent === undefined) throw new Error("Missing PGN upload");
    const chapter = model.chapters.find((c) => c.pgnId === sent.id);
    if (chapter === undefined) throw new Error("Missing chapter");
    model.openChapter(chapter.id);
    model.play("e2", "e4");
    const pending = model.data.pgns.find((p) => p.id === sent.id)?.pendingMutations.length ?? 0;
    model.applySync(
      {
        ...emptyResponse(),
        acknowledgedPgn: { id: sent.id, revision: "r1", byteSize: 20, updatedAt: sent.updatedAt },
      },
      request,
    );
    expect(model.data.pgns.find((p) => p.id === sent.id)?.pendingMutations).toHaveLength(
      pending - sent.mutations.length,
    );
  });
});
