import { Eval, Orientation } from "@/lib/AppState";
import { cn } from "@/lib/utils";

type EvalBarDisplay = {
  display: string;
  height: number;
  isWWinning: boolean;
};

export const EVAL_BAR_WHITE_CLASS = "bg-neutral-200 dark:bg-neutral-800";
export const EVAL_BAR_BLACK_CLASS = "bg-neutral-900 dark:bg-neutral-100";
export const EVAL_BAR_LIGHT_CLASS = "bg-neutral-200 dark:bg-neutral-100";
export const EVAL_BAR_DARK_CLASS = "bg-neutral-900 dark:bg-neutral-800";

function getEvalDisplay(evaluation: Eval | undefined): string {
  if (!evaluation) return "";

  switch (evaluation.score.type) {
    case "cp":
      return Math.abs(evaluation.score.value / 100).toFixed(1);
    case "mate-in":
      return `M${Math.abs(evaluation.score.value)}`;
    case "mate":
      return evaluation.score.winner === "white" ? "1-0" : "0-1";
    case "stalemate":
      return "½-½";
  }
}

function isWhiteWinning(evaluation: Eval | undefined): boolean {
  if (!evaluation) return false;

  switch (evaluation.score.type) {
    case "cp":
      return evaluation.score.value > 0;
    case "mate-in":
      return evaluation.score.value > 0;
    case "mate":
      return evaluation.score.winner === "white";
    case "stalemate":
      return false;
  }
}

export function EvalBar(props: { evaluation: Eval | undefined; orientation: Orientation }) {
  const displayedEval = () => getEvalBarDisplay(props.evaluation);
  const isWhiteOriented = () => props.orientation === "white";

  return (
    <div
      aria-label="Evaluation bar"
      class={cn(
        "relative h-6 w-full flex-shrink-0 overflow-hidden xl:h-auto xl:w-6",
        EVAL_BAR_WHITE_CLASS,
      )}
    >
      <div
        class={cn(
          "absolute top-0 h-full w-[var(--eval-fill)] transition-[width] duration-300 ease-emil-out motion-reduce:transition-none xl:h-[var(--eval-fill)] xl:w-full xl:transition-[height]",
          EVAL_BAR_BLACK_CLASS,
          isWhiteOriented()
            ? "left-0 xl:bottom-0 xl:left-auto xl:top-auto"
            : "right-0 xl:right-auto xl:top-0",
        )}
        style={{
          "--eval-fill": `${displayedEval().height}%`,
        }}
      />
      <div
        class={cn(
          "absolute top-1/2 -translate-y-1/2 px-1 text-center text-[0.6rem] font-bold leading-none xl:top-auto xl:w-full xl:translate-y-0 xl:px-0",
          displayedEval().isWWinning ? "text-neutral-950" : "text-neutral-100",
          displayedEval().isWWinning === isWhiteOriented()
            ? "left-0 xl:bottom-0 xl:left-auto"
            : "right-0 xl:right-auto xl:top-0",
        )}
      >
        {displayedEval().display}
      </div>
    </div>
  );
}

function getEvalBarDisplay(evaluation: Eval | undefined): EvalBarDisplay {
  if (evaluation === undefined) {
    return {
      display: "",
      height: 50,
      isWWinning: false,
    };
  }

  return {
    display: getEvalDisplay(evaluation),
    height: getEvaluationHeight(evaluation),
    isWWinning: isWhiteWinning(evaluation),
  };
}

function getEvaluationHeight(evaluation: Eval | undefined): number {
  if (!evaluation) return 50;

  if (evaluation.score.type === "mate") {
    return evaluation.score.winner === "white" ? 100 : 0;
  }

  if (evaluation.score.type === "stalemate") {
    return 50;
  }

  if (evaluation.score.type === "mate-in") {
    return evaluation.score.value > 0 ? 100 : 0;
  }

  const score = evaluation.score.value / 100;
  const percentage = 50 + 50 * (2 / (1 + Math.exp(-0.5 * score)) - 1);
  const result = Math.min(100, Math.max(0, percentage));
  return result;
}
