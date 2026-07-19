import {
  AppState,
  copyMoveLearningDetails,
  Context,
  deleteMove,
  emptyNormalizedPgn,
  EvalMove,
  Move,
  moveFromChessboard,
  moveFromEvalMove,
  initialTrainingReview,
} from "@/lib/AppState";
import { StoreState } from "@/lib/createStore";
import type { MutationResult } from "@/lib/useMutation";

export function learningLineKey(ctx: Context, lineId: string): string {
  return `${ctx.repertoireHandle}/${ctx.chapterHandle}/${lineId}`;
}

export function startLearningLine(state: StoreState<AppState>): void {
  state.set("training", {
    ...state.training,
    variation: emptyNormalizedPgn(),
  });
  state.set("selectedMoveId", null);
  state.set("preselectedVariation", null);
  state.set("animation", null);
}

export function playLearningMove(
  state: StoreState<AppState>,
  ctx: Context,
  details: {
    sourceMove: Move;
    input: EvalMove | { from: string; to: string; piece: string };
    animate: boolean;
  },
): MutationResult {
  const result =
    "piece" in details.input
      ? moveFromChessboard(state, ctx, details.input.from, details.input.to, details.input.piece)
      : moveFromEvalMove(state, ctx, details.input, details.animate);
  copyMoveLearningDetails(state, ctx, details.sourceMove);
  return result;
}

export function removeLearningPreview(
  state: StoreState<AppState>,
  _ctx: Context,
  moveId: number,
): void {
  deleteMove(state, _ctx, moveId);
  state.set("animation", null);
}

export function markLineLearned(state: StoreState<AppState>, ctx: Context, lineId: string): void {
  const key = learningLineKey(ctx, lineId);
  if (!state.learning.learnedLineKeys.includes(key)) {
    state.set("learning", {
      learnedLineKeys: [...state.learning.learnedLineKeys, key],
    });
  }
  state.set("training", {
    ...state.training,
    reviews: {
      ...state.training.reviews,
      [key]: initialTrainingReview(Date.now()),
    },
  });
}
