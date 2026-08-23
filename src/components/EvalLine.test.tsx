import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, expect, test } from "vitest";
import { createMemo, createSignal, For, flush } from "solid-js";
import type { Eval, EvalLineMove } from "@/lib/AppState";
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

function evaluationWithMove(move: EvalLineMove): Eval {
  return {
    ...evaluation(12),
    moves: [move],
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

test("keeps evaluation move tokens mounted when a deeper line replaces their moves", () => {
  function TestComponent() {
    const [currentEvaluation, setCurrentEvaluation] = createSignal(
      evaluationWithMove({
        from: "e2",
        to: "e4",
        promotion: null,
        san: "e4",
        fen: "fen-after-e4",
      }),
    );

    return (
      <>
        <button
          onClick={() =>
            setCurrentEvaluation(
              evaluationWithMove({
                from: "d2",
                to: "d4",
                promotion: null,
                san: "d4",
                fen: "fen-after-d4",
              }),
            )
          }
        >
          Update move
        </button>
        <EvaluationLineSlot evaluation={currentEvaluation()} onAddEvalMoves={() => undefined} />
      </>
    );
  }

  render(() => <TestComponent />);
  const moveToken = screen.getByText("e4");

  flush(() => fireEvent.click(screen.getByText("Update move")));

  expect(screen.getByText("d4")).toBe(moveToken);
});
