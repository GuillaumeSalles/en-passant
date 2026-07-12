import { describe, expect, test } from "vitest";
import { getEvaluationLineIndexes } from "../src/components/ComputerEvaluation";

describe("getEvaluationLineIndexes", () => {
  test("reserves a stable slot for each configured evaluation line", () => {
    expect(getEvaluationLineIndexes(3)).toEqual([0, 1, 2]);
  });

  test("uses the number of lines as the layout source", () => {
    expect(getEvaluationLineIndexes(1)).toEqual([0]);
    expect(getEvaluationLineIndexes(5)).toEqual([0, 1, 2, 3, 4]);
  });
});
