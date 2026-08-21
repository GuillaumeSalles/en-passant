import { describe, expect, test } from "vitest";
import {
  acceptsTrainingMove,
  initialVariationTrainingPhase,
  reduceVariationTrainingFlow,
  trainingInstruction,
  type VariationTrainingPhase,
} from "./variationTrainingFlow";

describe("variation training flow", () => {
  test.each<VariationTrainingPhase>([
    { type: "initializing" },
    {
      type: "showing-feedback",
      feedback: "mistake",
      square: "f3",
      playedMoveId: 1,
      expectedMoveId: 2,
    },
    {
      type: "waiting-for-response",
      completedMoveId: 1,
      finishesVariation: false,
      playedMoveId: 1,
      responseMoveId: 2,
    },
    { type: "preparing-replay", targetMoveId: 2 },
    { type: "line-complete" },
  ])("locks move input during $type", (phase) => {
    expect(acceptsTrainingMove(phase)).toBe(false);
  });

  test.each<VariationTrainingPhase>([
    { type: "awaiting-line-move", notice: null },
    { type: "awaiting-replay-move" },
  ])("accepts move input during $type", (phase) => {
    expect(acceptsTrainingMove(phase)).toBe(true);
  });

  test("derives instructions from the interaction phase", () => {
    expect(
      trainingInstruction({ type: "awaiting-line-move", notice: "alternative" }, "white", false),
    ).toBe("That move belongs to an alternative line. Find another one.");
    expect(trainingInstruction({ type: "awaiting-replay-move" }, "white", false)).toBe(
      "Replay the failed move.",
    );
    expect(
      trainingInstruction(
        {
          type: "waiting-for-response",
          completedMoveId: 1,
          finishesVariation: false,
          playedMoveId: 1,
          responseMoveId: 2,
        },
        "white",
        false,
      ),
    ).toBe("Waiting for the response.");
  });

  test("prioritizes returning to the end of a browsed line", () => {
    expect(trainingInstruction({ type: "awaiting-replay-move" }, "white", true)).toBe(
      "Go to the end of the line to continue the drill.",
    );
  });

  test("ignores stale animation completions", () => {
    const phase: VariationTrainingPhase = { type: "animating-intro", animationId: 3 };
    expect(reduceVariationTrainingFlow(phase, { type: "ANIMATION_SETTLED", animationId: 2 })).toBe(
      phase,
    );
    expect(
      reduceVariationTrainingFlow(phase, { type: "ANIMATION_SETTLED", animationId: 3 }),
    ).toEqual({ type: "awaiting-line-move", notice: null });
  });

  test("rejects events that are invalid for the current state", () => {
    expect(
      reduceVariationTrainingFlow(initialVariationTrainingPhase, {
        type: "FEEDBACK_ELAPSED",
      }),
    ).toBe(initialVariationTrainingPhase);
    const awaitingLine: VariationTrainingPhase = { type: "awaiting-line-move", notice: null };
    expect(
      reduceVariationTrainingFlow(awaitingLine, { type: "MOVE_SUBMITTED", origin: "replay" }),
    ).toBe(awaitingLine);
  });

  test("keeps input locked until the matching response animation settles", () => {
    const checking = reduceVariationTrainingFlow(
      { type: "awaiting-line-move", notice: null },
      { type: "MOVE_SUBMITTED", origin: "line" },
    );
    const waiting = reduceVariationTrainingFlow(checking, {
      type: "WAIT_FOR_RESPONSE",
      completedMoveId: 1,
      finishesVariation: false,
      playedMoveId: 1,
      responseMoveId: 2,
    });
    const starting = reduceVariationTrainingFlow(waiting, { type: "RESPONSE_DELAY_ELAPSED" });
    const animating = reduceVariationTrainingFlow(starting, {
      type: "RESPONSE_STARTED",
      animationId: 7,
    });

    expect(acceptsTrainingMove(animating)).toBe(false);
    expect(
      reduceVariationTrainingFlow(animating, { type: "ANIMATION_SETTLED", animationId: 6 }),
    ).toBe(animating);

    const settled = reduceVariationTrainingFlow(animating, {
      type: "ANIMATION_SETTLED",
      animationId: 7,
    });
    expect(settled.type).toBe("response-settled");
    expect(reduceVariationTrainingFlow(settled, { type: "RESPONSE_HANDLED" })).toEqual({
      type: "awaiting-line-move",
      notice: null,
    });
  });

  test("waits for replay setup animation before accepting the replayed move", () => {
    const preparing: VariationTrainingPhase = { type: "preparing-replay", targetMoveId: 4 };
    const starting = reduceVariationTrainingFlow(preparing, { type: "REPLAY_DELAY_ELAPSED" });
    const animating = reduceVariationTrainingFlow(starting, {
      type: "REPLAY_STARTED",
      animationId: 11,
    });

    expect(acceptsTrainingMove(animating)).toBe(false);
    expect(
      reduceVariationTrainingFlow(animating, { type: "ANIMATION_SETTLED", animationId: 11 }),
    ).toEqual({ type: "awaiting-replay-move" });
  });
});
