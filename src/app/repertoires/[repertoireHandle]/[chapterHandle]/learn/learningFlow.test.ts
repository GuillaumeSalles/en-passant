import { describe, expect, test } from "vitest";
import {
  acceptsLearningMove,
  initialLearningFlowState,
  learningInstruction,
  reduceLearningFlow,
  type LearningFlowState,
} from "./learningFlow";

describe("learning flow", () => {
  test("progresses from board readiness through a demonstrated move", () => {
    const ready = reduceLearningFlow(initialLearningFlowState, { type: "READY" });
    expect(ready).toEqual({
      state: { type: "advancing" },
      commands: [{ type: "START_LINE" }, { type: "ADVANCE" }],
    });

    const starting = reduceLearningFlow(ready.state, {
      type: "NEXT_MOVE",
      role: "preview",
      sourceMoveId: 12,
    });
    const animating = reduceLearningFlow(starting.state, {
      type: "ANIMATION_STARTED",
      sourceMoveId: 12,
      renderedMoveId: 1,
      animationId: 9,
    });
    const holding = reduceLearningFlow(animating.state, {
      type: "ANIMATION_SETTLED",
      animationId: 9,
    });
    const repeat = reduceLearningFlow(holding.state, {
      type: "PACING_ELAPSED",
      kind: "preview-hold",
    });

    expect(repeat).toEqual({
      state: { type: "awaiting-repeat" },
      commands: [{ type: "REMOVE_MOVE", moveId: 1 }],
    });
    expect(acceptsLearningMove(repeat.state)).toBe(true);
  });

  test("ignores stale animation and timer completions", () => {
    const animating: LearningFlowState = {
      type: "animating",
      role: "preview",
      sourceMoveId: 12,
      renderedMoveId: 1,
      animationId: 9,
    };
    expect(reduceLearningFlow(animating, { type: "ANIMATION_SETTLED", animationId: 8 })).toEqual({
      state: animating,
      commands: [],
    });

    const pacing: LearningFlowState = { type: "pacing", kind: "preview-hold", moveId: 1 };
    expect(reduceLearningFlow(pacing, { type: "PACING_ELAPSED", kind: "wrong" })).toEqual({
      state: pacing,
      commands: [],
    });
  });

  test("allows user input only while awaiting the repeated move", () => {
    const locked: LearningFlowState[] = [
      initialLearningFlowState,
      { type: "advancing" },
      { type: "starting-animation", role: "opponent", sourceMoveId: 1 },
      { type: "pacing", kind: "after-correct", moveId: null },
      { type: "reinforcement" },
      { type: "complete" },
    ];
    expect(locked.every((state) => !acceptsLearningMove(state))).toBe(true);
  });

  test("derives instructions from machine state", () => {
    expect(
      learningInstruction(
        { type: "animating", role: "opponent", sourceMoveId: 1, renderedMoveId: 1, animationId: 2 },
        "white",
      ),
    ).toBe("Black responds.");
    expect(learningInstruction({ type: "awaiting-repeat" }, "white")).toBe("Now repeat the move.");
  });

  test("captures the exact wrong move before scheduling its removal", () => {
    const wrong = reduceLearningFlow(
      { type: "awaiting-repeat" },
      {
        type: "WRONG_MOVE",
        input: { from: "g1", to: "f3", piece: "N", animate: true },
      },
    );
    expect(wrong.state).toEqual({ type: "recording-wrong", square: "f3" });

    const recorded = reduceLearningFlow(wrong.state, {
      type: "WRONG_MOVE_RECORDED",
      moveId: 42,
    });
    const elapsed = reduceLearningFlow(recorded.state, {
      type: "PACING_ELAPSED",
      kind: "wrong",
    });

    expect(elapsed).toEqual({
      state: { type: "awaiting-repeat" },
      commands: [{ type: "REMOVE_MOVE", moveId: 42 }],
    });
  });
});
