import { describe, expect, test } from "vitest";
import { getEvaluationRows } from "../src/components/ComputerEvaluation";
import type { Eval } from "../src/lib/AppState";

function evaluation(index: number): Eval {
  return {
    index,
    depth: 20,
    score: { type: "cp", value: 12 },
    moves: [],
  };
}

describe("getEvaluationRows", () => {
  test("reserves a row for each configured evaluation line", () => {
    expect(getEvaluationRows([evaluation(0)], 3)).toEqual([
      { kind: "evaluation", evaluation: evaluation(0) },
      { kind: "placeholder", index: 1 },
      { kind: "placeholder", index: 2 },
    ]);
  });

  test("uses evaluation indices and ignores stale extra lines", () => {
    expect(getEvaluationRows([evaluation(0), evaluation(1), evaluation(3)], 2)).toEqual([
      { kind: "evaluation", evaluation: evaluation(0) },
      { kind: "evaluation", evaluation: evaluation(1) },
    ]);
  });
});
