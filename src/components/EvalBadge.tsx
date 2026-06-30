import type { JSX } from "@solidjs/web";
import { createMemo } from "solid-js";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { NormalizedEvalScore } from "@/lib/AppState";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        white: "border-transparent bg-primary text-primary-foreground shadow",
        black: "border-transparent bg-secondary text-secondary-foreground",
      },
    },
  },
);

export interface BadgeProps extends JSX.HTMLAttributes<HTMLDivElement> {
  score: NormalizedEvalScore;
}

function getEvalDisplay(score: NormalizedEvalScore) {
  switch (score.type) {
    case "cp":
      return (score.value / 100).toFixed(1);
    case "mate-in":
      return `M${Math.abs(score.value)}`;
    case "mate":
      return score.winner === "white" ? "1-0" : "0-1";
    case "stalemate":
      return "½-½";
  }
}

function isWhiteWinning(score: NormalizedEvalScore): boolean {
  switch (score.type) {
    case "cp":
      return score.value > 0;
    case "mate-in":
      return score.value > 0;
    case "mate":
      return score.winner === "white";
    case "stalemate":
      return false;
  }
}

export function EvalBadge(props: BadgeProps) {
  const display = createMemo(() => getEvalDisplay(props.score));
  const isWhite = createMemo(() => isWhiteWinning(props.score));

  return (
    <div class={cn(badgeVariants({ variant: isWhite() ? "white" : "black" }), props.class)}>
      {display()}
    </div>
  );
}
