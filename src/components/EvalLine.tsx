import { Eval, EvalMove } from "@/lib/AppState";
import { EvalBadge } from "./EvalBadge";
import { HorizontalDashedDivider } from "./ui/HorizontalDashedDivider";
import type { JSX } from "@solidjs/web";
import { createMemo, For, Show } from "solid-js";
import { usePositionPreview } from "./PositionPreview";

function EvaluationLineFrame(props: {
  children: JSX.Element;
  ariaHidden?: "true" | undefined;
  depth?: number | undefined;
}) {
  return (
    <>
      <div
        class="flex flex-row items-center gap-2 overflow-x-auto px-4 py-2 text-xs"
        aria-hidden={props.ariaHidden}
        data-evaluation-depth={props.depth}
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
  const positionPreview = usePositionPreview();
  let moveSlotCache: { index: number }[] = [];
  const moveSlots = createMemo<{ index: number }[]>(() => {
    const slots = Array.from(
      { length: props.evaluation.moves.length },
      (_, index) => moveSlotCache[index] ?? { index },
    );
    moveSlotCache = slots;
    return slots;
  });

  return (
    <>
      <EvalBadge score={props.evaluation.score} />
      <For each={moveSlots()}>
        {(slot) => {
          const previewKey = `${props.evaluation.index}:${slot.index}`;

          return (
            <Show when={props.evaluation.moves[slot.index]}>
              {(move) => (
                <span
                  data-eval-move
                  data-from={move().from}
                  data-to={move().to}
                  class="cursor-pointer whitespace-nowrap hover:text-blue-500"
                  onPointerEnter={(event) =>
                    positionPreview.onPointerEnter(previewKey, () => move().fen, event)
                  }
                  onClick={() =>
                    props.onAddEvalMoves(props.evaluation.moves.slice(0, slot.index + 1))
                  }
                >
                  {move().san}
                </span>
              )}
            </Show>
          );
        }}
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
    <EvaluationLineFrame
      ariaHidden={props.evaluation === undefined ? "true" : undefined}
      depth={props.evaluation?.depth}
    >
      <Show when={props.evaluation} fallback={<EvaluationLinePlaceholder />}>
        {(evaluation) => (
          <EvaluationLineContent evaluation={evaluation()} onAddEvalMoves={props.onAddEvalMoves} />
        )}
      </Show>
    </EvaluationLineFrame>
  );
}
