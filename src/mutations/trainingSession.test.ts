import { afterEach, describe, expect, test, vi } from "vitest";
import {
  completeTrainingLine,
  completeTrainingReplayMove,
  createFailedMoveReplayQueue,
  ensureTrainingSession,
  markTrainingMistake,
  prepareTrainingReplayMove,
  resetTrainingSession,
  startTrainingLine,
} from "@/mutations/trainingSession";
import { createMutationContext } from "@/tests/mocks";
import { chapterStub, repertoireStub } from "@/tests/stubs";
import { learningLineKey, markLineLearned } from "@/mutations/learningSession";

afterEach(() => vi.useRealTimers());

const repertoire = repertoireStub({ id: "rep-1", handle: "white" });
const chapter = chapterStub({ id: "chapter-1", repertoireId: repertoire.id, handle: "main" });

function createTrainingContext() {
  return createMutationContext(
    {
      repertoires: { status: "success", data: { [repertoire.id]: repertoire } },
      chapters: { status: "success", data: { [chapter.id]: chapter } },
    },
    {
      type: "variation-training",
      repertoireHandle: repertoire.handle,
      chapterHandle: chapter.handle,
    },
  );
}

describe("training session", () => {
  test("keeps results for unchanged lines when the chapter lines change", () => {
    const context = createTrainingContext();
    ensureTrainingSession(context.state, context.route, ["line-a", "line-b"]);
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a", "line-b"],
      lineId: "line-a",
      variationIndex: 0,
    });
    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: true,
    });

    ensureTrainingSession(context.state, context.route, ["line-a", "line-c"]);

    expect(context.state.training.session?.lineIds).toEqual(["line-a", "line-c"]);
    expect(context.state.training.session?.results).toEqual([
      { lineId: "line-a", mistakeCount: 0 },
    ]);
  });

  test("records mistakes on the active line", () => {
    const context = createTrainingContext();
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a"],
      lineId: "line-a",
      variationIndex: 0,
    });
    markTrainingMistake(context.state, context.route, { moveId: 2 });
    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: true,
    });

    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });

    expect(context.state.training.status).toBe("success");
    expect(context.state.training.session?.results).toEqual([
      { lineId: "line-a", mistakeCount: 1 },
    ]);
  });

  test("advances a learned line after a clean review", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const context = createTrainingContext();
    const key = learningLineKey(context.route, "line-a");
    markLineLearned(context.state, context.route, "line-a");
    vi.setSystemTime(3_601_000);
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a"],
      lineId: "line-a",
      variationIndex: 0,
    });

    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: true,
    });

    expect(context.state.training.reviews[key]).toEqual({
      intervalIndex: 1,
      dueAt: 90_001_000,
    });
  });

  test("resets a learned line to one hour after a review with a mistake", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const context = createTrainingContext();
    const key = learningLineKey(context.route, "line-a");
    markLineLearned(context.state, context.route, "line-a");
    context.state.set("training", {
      ...context.state.training,
      reviews: {
        [key]: { intervalIndex: 4, dueAt: 1_000 },
      },
    });
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a"],
      lineId: "line-a",
      variationIndex: 0,
    });
    markTrainingMistake(context.state, context.route, { moveId: 2 });
    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: true,
    });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });

    expect(context.state.training.reviews[key]).toEqual({
      intervalIndex: 0,
      dueAt: 3_601_000,
    });
  });

  test("retraining a line replaces its previous result", () => {
    const context = createTrainingContext();
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a"],
      lineId: "line-a",
      variationIndex: 0,
    });
    markTrainingMistake(context.state, context.route, { moveId: 2 });
    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: true,
    });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: true });
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a"],
      lineId: "line-a",
      variationIndex: 0,
    });
    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: true,
    });

    expect(context.state.training.session?.results).toEqual([
      { lineId: "line-a", mistakeCount: 0 },
    ]);
  });

  test("can defer a result while repeating the entire line", () => {
    const context = createTrainingContext();
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a"],
      lineId: "line-a",
      variationIndex: 0,
    });
    markTrainingMistake(context.state, context.route, { moveId: 2 });

    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: false,
    });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: false });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: false });
    completeTrainingReplayMove(context, { lineId: "line-a", finishLine: false });

    expect(context.state.training.session).toMatchObject({
      currentMistakeCount: 1,
      failedMoveIds: [],
      replayMoveIds: [],
      results: [],
    });

    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: true,
    });
    expect(context.state.training.session?.results).toEqual([
      { lineId: "line-a", mistakeCount: 1 },
    ]);
  });

  test("resets results while retaining the current line list", () => {
    const context = createTrainingContext();
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a", "line-b"],
      lineId: "line-a",
      variationIndex: 0,
    });
    completeTrainingLine(context, {
      lineId: "line-a",
      completedMoveId: 4,
      finishLine: true,
    });

    resetTrainingSession(context.state, context.route);

    expect(context.state.training.session).toMatchObject({
      lineIds: ["line-a", "line-b"],
      activeLineId: null,
      results: [],
    });
  });

  test("replays failed moves in rounds until each has three successes", () => {
    expect(createFailedMoveReplayQueue([2, 5], 5)).toEqual([2, 5, 2, 5, 2]);
  });

  test("animates the previous move when preparing a failed move replay", () => {
    const context = createTrainingContext();

    prepareTrainingReplayMove(context.state, context.route, {
      animateLastMove: true,
      precedingMoves: [
        { from: "e2", to: "e4", promotion: null, san: "e4" },
        { from: "e7", to: "e5", promotion: null, san: "e5" },
      ],
    });

    expect(context.state.animation?.movements).toEqual([{ piece: "p", from: "e7", to: "e5" }]);
  });
});
