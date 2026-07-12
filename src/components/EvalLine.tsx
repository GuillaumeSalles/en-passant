import { Eval, EvalMove } from "@/lib/AppState";
import { EvalBadge } from "./EvalBadge";
import { HorizontalDashedDivider } from "./ui/HorizontalDashedDivider";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

function EvaluationLineFrame(props: { children: JSX.Element; ariaHidden?: "true" | undefined }) {
  return (
    <>
      <div
        class="flex flex-row items-center gap-2 overflow-x-auto px-4 py-2 text-xs"
        aria-hidden={props.ariaHidden}
      >
        {props.children}
      </div>
      <HorizontalDashedDivider direction="right-to-left" />
    </>
  );
}

function EvaluationLineContent(props: {
  evaluation: Eval;
  onAddEvalMoves: (moves: EvalMove[]) => void;
}) {
  return (
    <>
      <EvalBadge score={props.evaluation.score} />
      <For each={props.evaluation.moves}>
        {(move, index) => (
          <span
            class="cursor-pointer whitespace-nowrap hover:text-blue-500"
            onClick={() => props.onAddEvalMoves(props.evaluation.moves.slice(0, index() + 1))}
          >
            {move.san}
          </span>
        )}
      </For>
    </>
  );
}

function EvaluationLinePlaceholder() {
  return (
    <>
      <span class="h-5 w-12 shrink-0 rounded-md bg-muted" />
      <span class="h-3 w-10 shrink-0 rounded-sm bg-muted" />
      <span class="h-3 w-14 shrink-0 rounded-sm bg-muted" />
      <span class="h-3 w-12 shrink-0 rounded-sm bg-muted" />
    </>
  );
}

export function EvaluationLineSlot(props: {
  evaluation: Eval | undefined;
  onAddEvalMoves: (moves: EvalMove[]) => void;
}) {
  return (
    <EvaluationLineFrame ariaHidden={props.evaluation === undefined ? "true" : undefined}>
      <Show when={props.evaluation} fallback={<EvaluationLinePlaceholder />}>
        {(evaluation) => (
          <EvaluationLineContent evaluation={evaluation()} onAddEvalMoves={props.onAddEvalMoves} />
        )}
      </Show>
    </EvaluationLineFrame>
  );
}
