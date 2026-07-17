import { describe, expect, test } from "vitest";
import {
  completeTrainingLine,
  ensureTrainingSession,
  markTrainingMistake,
  resetTrainingSession,
  startTrainingLine,
} from "@/mutations/trainingSession";
import { createMutationContext } from "@/tests/mocks";
import { chapterStub, repertoireStub } from "@/tests/stubs";

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
    completeTrainingLine(context, { lineId: "line-a" });

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
    markTrainingMistake(context.state, context.route);
    completeTrainingLine(context, { lineId: "line-a" });

    expect(context.state.training.status).toBe("success");
    expect(context.state.training.session?.results).toEqual([
      { lineId: "line-a", mistakeCount: 1 },
    ]);
  });

  test("retraining a line replaces its previous result", () => {
    const context = createTrainingContext();
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a"],
      lineId: "line-a",
      variationIndex: 0,
    });
    markTrainingMistake(context.state, context.route);
    completeTrainingLine(context, { lineId: "line-a" });
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a"],
      lineId: "line-a",
      variationIndex: 0,
    });
    completeTrainingLine(context, { lineId: "line-a" });

    expect(context.state.training.session?.results).toEqual([
      { lineId: "line-a", mistakeCount: 0 },
    ]);
  });

  test("resets results while retaining the current line list", () => {
    const context = createTrainingContext();
    startTrainingLine(context.state, context.route, {
      lineIds: ["line-a", "line-b"],
      lineId: "line-a",
      variationIndex: 0,
    });
    completeTrainingLine(context, { lineId: "line-a" });

    resetTrainingSession(context.state, context.route);

    expect(context.state.training.session).toMatchObject({
      lineIds: ["line-a", "line-b"],
      activeLineId: null,
      results: [],
    });
  });
});
