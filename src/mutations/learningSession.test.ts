import { normalizePgn } from "@/lib/AppState";
import {
  trainingLineScheduleKey,
  markLineLearned,
  playLearningMove,
  removeLearningPreview,
  startLearningLine,
} from "@/mutations/learningSession";
import { createMutationContext } from "@/tests/mocks";
import { afterEach, describe, expect, test, vi } from "vitest";
import { chapterStub, repertoireStub } from "@/tests/stubs";

afterEach(() => vi.useRealTimers());

function createLearningContext() {
  const repertoire = repertoireStub({ id: "rep-1", handle: "white" });
  const chapter = chapterStub({
    id: "chapter-1",
    repertoireId: repertoire.id,
    handle: "main",
  });
  return createMutationContext(
    {
      repertoires: { status: "success", data: { [repertoire.id]: repertoire } },
      chapters: { status: "success", data: { [chapter.id]: chapter } },
    },
    {
      type: "variation-training",
      repertoireHandle: "white",
      chapterHandle: "main",
    },
  );
}

describe("learning session", () => {
  test("reveals a move with its learning annotations and can remove the preview", () => {
    const context = createLearningContext();
    const sourcePgn = normalizePgn("1. e4 $1 {Take the center.} e5 {Black responds.} *");
    const sourceMove = sourcePgn.moves[sourcePgn.rootMoveIds[0] ?? -1];
    if (sourceMove === undefined) throw new Error("Expected a source move");

    startLearningLine(context.state);
    playLearningMove(context.state, context.route, {
      sourceMove,
      input: {
        from: sourceMove.from,
        to: sourceMove.to,
        promotion: sourceMove.promotion,
        san: sourceMove.san,
      },
      animate: true,
    });

    const previewMoveId = context.state.selectedMoveId;
    expect(previewMoveId).not.toBeNull();
    expect(context.state.training.variation.moves[previewMoveId ?? -1]).toMatchObject({
      nags: [1],
      commentAfter: "Take the center.",
    });

    removeLearningPreview(context.state, context.route, previewMoveId ?? -1);

    expect(context.state.training.variation.rootMoveIds).toEqual([]);
    expect(context.state.selectedMoveId).toBeNull();
    expect(context.state.animation).toBeNull();

    playLearningMove(context.state, context.route, {
      sourceMove,
      input: { from: sourceMove.from, to: sourceMove.to, piece: "wP" },
      animate: false,
    });

    expect(Object.values(context.state.training.variation.moves)).toHaveLength(1);
    expect(Object.values(context.state.training.variation.moves)[0]).toMatchObject({
      san: "e4",
      commentAfter: "Take the center.",
    });
  });

  test("records learned lines once for the current chapter", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const context = createLearningContext();
    const key = trainingLineScheduleKey(context.state, context.route, "e2e4 e7e5");
    if (key === null) throw new Error("Expected a training line key");

    markLineLearned(context.state, context.route, "e2e4 e7e5");
    markLineLearned(context.state, context.route, "e2e4 e7e5");

    expect(context.state.training.reviews[key]).toEqual({
      repertoireId: "rep-1",
      chapterId: "chapter-1",
      uciPath: "e2e4 e7e5",
      intervalIndex: 0,
      dueAt: 3_601_000,
      lastReviewedAt: 1_000,
      algorithmVersion: 1,
    });
  });
});
