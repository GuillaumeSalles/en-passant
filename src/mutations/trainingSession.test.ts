import { afterEach, describe, expect, test, vi } from "vitest";
import {
  completeTrainingLine,
  markTrainingMistake,
  resetTrainingSession,
  startTrainingSession,
} from "@/mutations/trainingSession";
import { createMutationContext } from "@/tests/mocks";
import { chapterStub, repertoireStub } from "@/tests/stubs";

const repertoire = repertoireStub({ id: "rep-1", handle: "white" });
const chapter = chapterStub({
  id: "chapter-1",
  repertoireId: repertoire.id,
  handle: "main",
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createTrainingContext() {
  return createMutationContext(
    {
      repertoires: {
        status: "success",
        data: { [repertoire.id]: repertoire },
      },
      chapters: {
        status: "success",
        data: { [chapter.id]: chapter },
      },
    },
    {
      type: "variation-training",
      repertoireHandle: repertoire.handle,
      chapterHandle: chapter.handle,
    },
  );
}

describe("training session", () => {
  test("starts a session at the first randomized variation", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.6)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.9);
    const context = createTrainingContext();

    startTrainingSession(context.state, context.route, 4);

    expect(context.state.training.status).toBe("in-progress");
    expect(context.state.training.variationIndex).toBe(3);
    expect(context.state.training.session?.queue).toEqual([3, 1, 0, 2]);
    expect(context.state.training.session?.results).toEqual([]);
  });

  test("marks a mistake for the active session", () => {
    const context = createTrainingContext();
    startTrainingSession(context.state, context.route, 1);

    markTrainingMistake(context.state, context.route);

    expect(context.state.training.status).toBe("failure");
    expect(context.state.training.session).toMatchObject({
      repertoireHandle: "white",
      chapterHandle: "main",
      queue: [0],
      queueCursor: 0,
      currentMistakeCount: 1,
      results: [],
    });
  });

  test("records the line result and completes when there are no more queued lines", () => {
    const context = createTrainingContext();
    startTrainingSession(context.state, context.route, 1);
    markTrainingMistake(context.state, context.route);

    completeTrainingLine(context, { variationIndex: 0 });

    expect(context.state.training.status).toBe("complete");
    expect(context.state.training.session?.results).toEqual([
      { variationIndex: 0, mistakeCount: 1 },
    ]);
    expect(context.state.training.session?.currentMistakeCount).toBe(0);
  });

  test("resets the active training session", () => {
    const context = createTrainingContext();
    startTrainingSession(context.state, context.route, 2);
    markTrainingMistake(context.state, context.route);
    context.state.set("selectedMoveId", 1);
    context.state.set("preselectedVariation", 2);
    context.state.set("animation", {
      id: 1,
      movements: [{ piece: "P", from: "e2", to: "e4" }],
      captures: [],
      promotion: null,
    });

    resetTrainingSession(context.state, context.route);

    expect(context.state.training.status).toBe("in-progress");
    expect(context.state.training.variationIndex).toBe(0);
    expect(context.state.training.session).toBeNull();
    expect(context.state.training.variation.rootMoveIds).toEqual([]);
    expect(context.state.selectedMoveId).toBeNull();
    expect(context.state.preselectedVariation).toBeNull();
    expect(context.state.animation).toBeNull();
  });
});
