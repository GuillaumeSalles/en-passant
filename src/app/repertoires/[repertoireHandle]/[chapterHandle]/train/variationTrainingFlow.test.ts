import { describe, expect, test } from "vitest";
import {
  acceptsTrainingMove,
  trainingInstruction,
  type VariationTrainingPhase,
} from "./variationTrainingFlow";

describe("variation training flow", () => {
  test.each<VariationTrainingPhase>([
    { type: "initializing" },
    { type: "showing-feedback", feedback: "mistake", square: "f3" },
    { type: "waiting-for-response" },
    { type: "preparing-replay" },
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
    expect(trainingInstruction({ type: "waiting-for-response" }, "white", false)).toBe(
      "Waiting for the response.",
    );
  });

  test("prioritizes returning to the end of a browsed line", () => {
    expect(trainingInstruction({ type: "awaiting-replay-move" }, "white", true)).toBe(
      "Go to the end of the line to continue the drill.",
    );
  });
});
