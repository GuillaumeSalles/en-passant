import { normalizePgn } from "@/lib/AppState";
import {
  learningLineKey,
  markLineLearned,
  playLearningMove,
  removeLearningPreview,
  startLearningLine,
} from "@/mutations/learningSession";
import { createMutationContext } from "@/tests/mocks";
import { describe, expect, test } from "vitest";

function createLearningContext() {
  return createMutationContext(
    {},
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
    const context = createLearningContext();
    const key = learningLineKey(context.route, "v1-line");

    markLineLearned(context.state, context.route, "v1-line");
    markLineLearned(context.state, context.route, "v1-line");

    expect(context.state.learning.learnedLineKeys).toEqual([key]);
  });
});
