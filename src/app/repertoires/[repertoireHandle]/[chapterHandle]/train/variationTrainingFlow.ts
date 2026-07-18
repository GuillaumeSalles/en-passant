import type { Orientation } from "@/lib/AppState";

export type TrainingMoveFeedback = "alternative" | "mistake";

export type VariationTrainingPhase =
  | { type: "initializing" }
  | { type: "awaiting-line-move"; notice: TrainingMoveFeedback | null }
  | { type: "showing-feedback"; feedback: TrainingMoveFeedback; square: string }
  | { type: "waiting-for-response" }
  | { type: "preparing-replay" }
  | { type: "awaiting-replay-move" }
  | { type: "line-complete" };

export function acceptsTrainingMove(phase: VariationTrainingPhase): boolean {
  return phase.type === "awaiting-line-move" || phase.type === "awaiting-replay-move";
}

export function trainingInstruction(
  phase: VariationTrainingPhase,
  orientation: Orientation,
  hasMovesAfterSelection: boolean,
): string {
  if (hasMovesAfterSelection) return "Go to the end of the line to continue the drill.";

  switch (phase.type) {
    case "initializing":
      return "Preparing the line.";
    case "awaiting-line-move":
      if (phase.notice === "alternative") {
        return "That move belongs to an alternative line. Find another one.";
      }
      if (phase.notice === "mistake") return "Try again.";
      return `${orientation === "black" ? "Black" : "White"} to play.`;
    case "showing-feedback":
      return phase.feedback === "alternative"
        ? "That move belongs to an alternative line. Find another one."
        : "Checking the move.";
    case "waiting-for-response":
      return "Waiting for the response.";
    case "preparing-replay":
      return "Preparing the failed move replay.";
    case "awaiting-replay-move":
      return "Replay the failed move.";
    case "line-complete":
      return "Good job!";
  }
}
