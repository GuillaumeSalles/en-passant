import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { createMemo, createSignal, For, flush } from "solid-js";
import type { Eval } from "@/lib/AppState";
import { getEvaluationLineIndexes } from "./ComputerEvaluation";
import { EvaluationLineSlot } from "./EvalLine";

afterEach(cleanup);

function evaluation(value: number): Eval {
  return {
    index: 0,
    depth: 20,
    score: { type: "cp", value },
    moves: [],
  };
}

test("keeps evaluation line frame mounted when the evaluation updates", () => {
  function TestComponent() {
    const [evaluations, setEvaluations] = createSignal([evaluation(12)]);
    const evaluationsByIndex = createMemo(
      () => new Map(evaluations().map((evaluation) => [evaluation.index, evaluation])),
    );
    const evaluationLineIndexes = createMemo<number[]>(() => getEvaluationLineIndexes(1));

    return (
      <>
        <button onClick={() => setEvaluations([evaluation(24)])}>Update</button>
        <For each={evaluationLineIndexes()}>
          {(lineIndex) => (
            <EvaluationLineSlot
              evaluation={evaluationsByIndex().get(lineIndex)}
              onAddEvalMoves={() => undefined}
            />
          )}
        </For>
      </>
    );
  }

  render(() => <TestComponent />);
  const row = screen.getByText("0.1").parentElement;
  const divider = row?.nextElementSibling;

  flush(() => fireEvent.click(screen.getByText("Update")));

  const updatedRow = screen.getByText("0.2").parentElement;
  expect(updatedRow).toBe(row);
  expect(updatedRow?.nextElementSibling).toBe(divider);
});
