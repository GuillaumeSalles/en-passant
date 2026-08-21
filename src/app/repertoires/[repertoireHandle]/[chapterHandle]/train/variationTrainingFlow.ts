import type { Orientation } from "@/lib/AppState";

export type TrainingMoveFeedback = "alternative" | "mistake";
export type TrainingMoveOrigin = "line" | "replay";

type PendingResponse = {
  completedMoveId: number;
  finishesVariation: boolean;
  playedMoveId: number | null;
  responseMoveId: number;
};

export type VariationTrainingPhase =
  | { type: "initializing" }
  | { type: "animating-intro"; animationId: number }
  | { type: "awaiting-line-move"; notice: TrainingMoveFeedback | null }
  | { type: "awaiting-replay-move" }
  | { type: "checking-move"; origin: TrainingMoveOrigin }
  | {
      type: "showing-feedback";
      feedback: TrainingMoveFeedback;
      square: string;
      playedMoveId: number | null;
      expectedMoveId: number;
    }
  | ({ type: "waiting-for-response" } & PendingResponse)
  | ({ type: "starting-response" } & PendingResponse)
  | ({ type: "animating-response"; animationId: number } & PendingResponse)
  | ({ type: "response-settled" } & PendingResponse)
  | { type: "preparing-replay"; targetMoveId: number }
  | { type: "starting-replay"; targetMoveId: number }
  | { type: "animating-replay"; animationId: number }
  | { type: "line-boundary" }
  | { type: "line-complete" };

export type VariationTrainingEvent =
  | { type: "RESET" }
  | { type: "READY_FOR_LINE_MOVE" }
  | { type: "INTRO_MOVE_STARTED"; animationId: number | null }
  | { type: "MOVE_SUBMITTED"; origin: TrainingMoveOrigin }
  | {
      type: "MOVE_REJECTED";
      feedback: TrainingMoveFeedback;
      square: string;
      playedMoveId: number | null;
      expectedMoveId: number;
    }
  | { type: "FEEDBACK_ELAPSED" }
  | ({ type: "WAIT_FOR_RESPONSE" } & PendingResponse)
  | { type: "RESPONSE_DELAY_ELAPSED" }
  | { type: "RESPONSE_STARTED"; animationId: number | null }
  | { type: "RESPONSE_HANDLED" }
  | { type: "REPLAY_REQUIRED"; targetMoveId: number }
  | { type: "REPLAY_DELAY_ELAPSED" }
  | { type: "REPLAY_STARTED"; animationId: number | null }
  | { type: "ANIMATION_SETTLED"; animationId: number }
  | { type: "LINE_BOUNDARY_STARTED" }
  | { type: "LINE_BOUNDARY_ELAPSED"; finished: boolean; orientation: Orientation };

export const initialVariationTrainingPhase: VariationTrainingPhase = { type: "initializing" };

export function reduceVariationTrainingFlow(
  phase: VariationTrainingPhase,
  event: VariationTrainingEvent,
): VariationTrainingPhase {
  if (event.type === "RESET") return initialVariationTrainingPhase;

  switch (phase.type) {
    case "initializing":
      if (event.type === "READY_FOR_LINE_MOVE") {
        return { type: "awaiting-line-move", notice: null };
      }
      if (event.type === "INTRO_MOVE_STARTED") {
        return event.animationId === null
          ? { type: "awaiting-line-move", notice: null }
          : { type: "animating-intro", animationId: event.animationId };
      }
      return phase;
    case "animating-intro":
      return event.type === "ANIMATION_SETTLED" && event.animationId === phase.animationId
        ? { type: "awaiting-line-move", notice: null }
        : phase;
    case "awaiting-line-move":
      return event.type === "MOVE_SUBMITTED" && event.origin === "line"
        ? { type: "checking-move", origin: event.origin }
        : phase;
    case "awaiting-replay-move":
      return event.type === "MOVE_SUBMITTED" && event.origin === "replay"
        ? { type: "checking-move", origin: event.origin }
        : phase;
    case "checking-move":
      if (event.type === "MOVE_REJECTED") {
        return {
          type: "showing-feedback",
          feedback: event.feedback,
          square: event.square,
          playedMoveId: event.playedMoveId,
          expectedMoveId: event.expectedMoveId,
        };
      }
      if (event.type === "WAIT_FOR_RESPONSE" && phase.origin === "line") {
        return {
          type: "waiting-for-response",
          completedMoveId: event.completedMoveId,
          finishesVariation: event.finishesVariation,
          playedMoveId: event.playedMoveId,
          responseMoveId: event.responseMoveId,
        };
      }
      if (event.type === "REPLAY_REQUIRED") {
        return { type: "preparing-replay", targetMoveId: event.targetMoveId };
      }
      return event.type === "LINE_BOUNDARY_STARTED" ? { type: "line-boundary" } : phase;
    case "showing-feedback":
      return event.type === "FEEDBACK_ELAPSED"
        ? { type: "awaiting-line-move", notice: phase.feedback }
        : phase;
    case "waiting-for-response":
      return event.type === "RESPONSE_DELAY_ELAPSED"
        ? { ...phase, type: "starting-response" }
        : phase;
    case "starting-response":
      if (event.type !== "RESPONSE_STARTED") return phase;
      return event.animationId === null
        ? { ...phase, type: "response-settled" }
        : { ...phase, type: "animating-response", animationId: event.animationId };
    case "animating-response":
      return event.type === "ANIMATION_SETTLED" && event.animationId === phase.animationId
        ? { ...phase, type: "response-settled" }
        : phase;
    case "response-settled":
      if (event.type === "RESPONSE_HANDLED") {
        return { type: "awaiting-line-move", notice: null };
      }
      if (event.type === "REPLAY_REQUIRED") {
        return { type: "preparing-replay", targetMoveId: event.targetMoveId };
      }
      return event.type === "LINE_BOUNDARY_STARTED" ? { type: "line-boundary" } : phase;
    case "preparing-replay":
      return event.type === "REPLAY_DELAY_ELAPSED"
        ? { type: "starting-replay", targetMoveId: phase.targetMoveId }
        : phase;
    case "starting-replay":
      if (event.type !== "REPLAY_STARTED") return phase;
      return event.animationId === null
        ? { type: "awaiting-replay-move" }
        : { type: "animating-replay", animationId: event.animationId };
    case "animating-replay":
      return event.type === "ANIMATION_SETTLED" && event.animationId === phase.animationId
        ? { type: "awaiting-replay-move" }
        : phase;
    case "line-boundary":
      if (event.type !== "LINE_BOUNDARY_ELAPSED") return phase;
      if (event.finished) return { type: "line-complete" };
      return event.orientation === "white"
        ? { type: "awaiting-line-move", notice: null }
        : { type: "initializing" };
    case "line-complete":
      return phase;
  }
}

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
    case "animating-intro":
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
    case "awaiting-replay-move":
      return "Replay the failed move.";
    case "preparing-replay":
    case "starting-replay":
    case "animating-replay":
      return "Preparing the failed move replay.";
    case "line-complete":
      return "Good job!";
    default:
      return "Waiting for the response.";
  }
}
