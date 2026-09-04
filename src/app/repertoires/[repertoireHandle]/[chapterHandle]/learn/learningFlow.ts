import type { Orientation } from "@/lib/AppState";

export type LearningPacingKind = "after-correct" | "after-opponent" | "preview-hold" | "wrong";
type LearningPacingStateKind = Exclude<LearningPacingKind, "wrong">;
export type LearningMoveRole = "opponent" | "preview";

export type LearningFlowState =
  | { type: "waiting-for-intro" }
  | { type: "advancing" }
  | { type: "starting-animation"; role: LearningMoveRole; sourceMoveId: number }
  | {
      type: "animating";
      role: LearningMoveRole;
      sourceMoveId: number;
      renderedMoveId: number;
      animationId: number;
    }
  | { type: "pacing"; kind: LearningPacingStateKind; moveId: number | null }
  | { type: "awaiting-repeat" }
  | { type: "recording-wrong"; square: string }
  | { type: "showing-wrong"; moveId: number; square: string }
  | { type: "reinforcement" }
  | { type: "complete" };

export type LearningMoveInput = {
  from: string;
  to: string;
  piece: string;
  animate: boolean;
};

export type LearningFlowEvent =
  | { type: "READY" }
  | { type: "NEXT_MOVE"; role: LearningMoveRole; sourceMoveId: number }
  | { type: "NO_NEXT_MOVE" }
  | {
      type: "ANIMATION_STARTED";
      sourceMoveId: number;
      renderedMoveId: number;
      animationId: number | null;
    }
  | { type: "ANIMATION_SETTLED"; animationId: number }
  | { type: "PACING_ELAPSED"; kind: LearningPacingKind }
  | { type: "CORRECT_MOVE"; sourceMoveId: number; input: LearningMoveInput }
  | { type: "WRONG_MOVE"; input: LearningMoveInput }
  | { type: "WRONG_MOVE_RECORDED"; moveId: number }
  | { type: "REINFORCEMENT_COMPLETE" }
  | { type: "RESET" };

export type LearningFlowCommand =
  | { type: "START_LINE" }
  | { type: "ADVANCE" }
  | { type: "PLAY_ANIMATED_MOVE"; sourceMoveId: number }
  | { type: "PLAY_CORRECT_MOVE"; sourceMoveId: number; input: LearningMoveInput }
  | { type: "PLAY_WRONG_MOVE"; input: LearningMoveInput }
  | { type: "REMOVE_MOVE"; moveId: number }
  | { type: "SCHEDULE_PACING"; kind: LearningPacingKind };

export type LearningFlowTransition = {
  state: LearningFlowState;
  commands: LearningFlowCommand[];
};

export const initialLearningFlowState: LearningFlowState = { type: "waiting-for-intro" };

function unchanged(state: LearningFlowState): LearningFlowTransition {
  return { state, commands: [] };
}

function afterAnimatedMove(role: LearningMoveRole, renderedMoveId: number): LearningFlowTransition {
  const kind = role === "opponent" ? "after-opponent" : "preview-hold";
  return {
    state: { type: "pacing", kind, moveId: role === "preview" ? renderedMoveId : null },
    commands: [{ type: "SCHEDULE_PACING", kind }],
  };
}

export function reduceLearningFlow(
  state: LearningFlowState,
  event: LearningFlowEvent,
): LearningFlowTransition {
  if (event.type === "RESET") return { state: initialLearningFlowState, commands: [] };

  switch (state.type) {
    case "waiting-for-intro":
      return event.type === "READY"
        ? {
            state: { type: "advancing" },
            commands: [{ type: "START_LINE" }, { type: "ADVANCE" }],
          }
        : unchanged(state);
    case "advancing":
      if (event.type === "NO_NEXT_MOVE") {
        return {
          state: { type: "reinforcement" },
          commands: [],
        };
      }
      return event.type === "NEXT_MOVE"
        ? {
            state: {
              type: "starting-animation",
              role: event.role,
              sourceMoveId: event.sourceMoveId,
            },
            commands: [
              {
                type: "PLAY_ANIMATED_MOVE",
                sourceMoveId: event.sourceMoveId,
              },
            ],
          }
        : unchanged(state);
    case "starting-animation":
      if (event.type !== "ANIMATION_STARTED" || event.sourceMoveId !== state.sourceMoveId) {
        return unchanged(state);
      }
      return event.animationId === null
        ? afterAnimatedMove(state.role, event.renderedMoveId)
        : {
            state: {
              type: "animating",
              role: state.role,
              sourceMoveId: state.sourceMoveId,
              renderedMoveId: event.renderedMoveId,
              animationId: event.animationId,
            },
            commands: [],
          };
    case "animating":
      return event.type === "ANIMATION_SETTLED" && event.animationId === state.animationId
        ? afterAnimatedMove(state.role, state.renderedMoveId)
        : unchanged(state);
    case "pacing":
      if (event.type !== "PACING_ELAPSED" || event.kind !== state.kind) {
        return unchanged(state);
      }
      if (state.kind === "preview-hold") {
        return {
          state: { type: "awaiting-repeat" },
          commands: state.moveId === null ? [] : [{ type: "REMOVE_MOVE", moveId: state.moveId }],
        };
      }
      return { state: { type: "advancing" }, commands: [{ type: "ADVANCE" }] };
    case "awaiting-repeat":
      if (event.type === "CORRECT_MOVE") {
        return {
          state: { type: "pacing", kind: "after-correct", moveId: null },
          commands: [
            {
              type: "PLAY_CORRECT_MOVE",
              sourceMoveId: event.sourceMoveId,
              input: event.input,
            },
            { type: "SCHEDULE_PACING", kind: "after-correct" },
          ],
        };
      }
      return event.type === "WRONG_MOVE"
        ? {
            state: { type: "recording-wrong", square: event.input.to },
            commands: [{ type: "PLAY_WRONG_MOVE", input: event.input }],
          }
        : unchanged(state);
    case "recording-wrong":
      return event.type === "WRONG_MOVE_RECORDED"
        ? {
            state: { type: "showing-wrong", moveId: event.moveId, square: state.square },
            commands: [{ type: "SCHEDULE_PACING", kind: "wrong" }],
          }
        : unchanged(state);
    case "showing-wrong":
      return event.type === "PACING_ELAPSED" && event.kind === "wrong"
        ? {
            state: { type: "awaiting-repeat" },
            commands: [{ type: "REMOVE_MOVE", moveId: state.moveId }],
          }
        : unchanged(state);
    case "reinforcement":
      return event.type === "REINFORCEMENT_COMPLETE"
        ? { state: { type: "complete" }, commands: [] }
        : unchanged(state);
    case "complete":
      return unchanged(state);
  }
}

export function acceptsLearningMove(state: LearningFlowState): boolean {
  return state.type === "awaiting-repeat";
}

export function canDragLearningPiece(state: LearningFlowState): boolean {
  if (acceptsLearningMove(state)) return true;
  if (state.type === "animating") return state.role === "opponent";
  return state.type === "pacing" && state.kind === "after-opponent";
}

export function learningInstruction(state: LearningFlowState, orientation: Orientation): string {
  switch (state.type) {
    case "starting-animation":
    case "animating":
      return state.role === "preview"
        ? "Watch this move."
        : `${orientation === "white" ? "Black" : "White"} responds.`;
    case "pacing":
      if (state.kind === "preview-hold") return "Watch this move.";
      if (state.kind === "after-opponent") {
        return `${orientation === "white" ? "Black" : "White"} responds.`;
      }
      return "Get ready…";
    case "awaiting-repeat":
      return "Now repeat the move.";
    case "recording-wrong":
    case "showing-wrong":
      return "That’s not the move. Try again.";
    case "complete":
      return "Line learned.";
    default:
      return "Get ready…";
  }
}
