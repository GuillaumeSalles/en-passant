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
  getChapter,
  getRepertoire,
  trainingLineReviewKey,
  type TrainingLineReview,
} from "@/lib/AppState";
import { StoreState } from "@/lib/createStore";
import type { MutationResult } from "@/lib/useMutation";

export function trainingLineIdentity(
  state: AppState,
  ctx: Context,
  uciPath: string,
): Pick<TrainingLineReview, "repertoireId" | "chapterId" | "uciPath"> | null {
  const repertoire = getRepertoire(state, ctx);
  if (repertoire === undefined) return null;
  const chapter = getChapter(state, repertoire.id, ctx.chapterHandle);
  if (chapter === undefined) return null;
  return { repertoireId: repertoire.id, chapterId: chapter.id, uciPath };
}

export function trainingLineScheduleKey(
  state: AppState,
  ctx: Context,
  uciPath: string,
): string | null {
  const identity = trainingLineIdentity(state, ctx, uciPath);
  return identity === null
    ? null
    : trainingLineReviewKey(identity.repertoireId, identity.chapterId, identity.uciPath);
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

export function markLineLearned(
  state: StoreState<AppState>,
  ctx: Context,
  uciPath: string,
): MutationResult {
  const identity = trainingLineIdentity(state, ctx, uciPath);
  if (identity === null) return;
  const key = trainingLineReviewKey(identity.repertoireId, identity.chapterId, identity.uciPath);
  const schedule = initialTrainingReview(identity, Date.now());
  state.set("training", {
    ...state.training,
    reviews: {
      ...state.training.reviews,
      [key]: schedule,
    },
  });
  return { type: "persist-training-line-schedule", schedule };
}
