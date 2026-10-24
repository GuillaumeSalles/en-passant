import {
  getChapterScope,
  getChapterPgn,
  getTrainingMoveTarget,
  trainingMoveReviewKey,
  type TrainingMoveOutcome,
} from "@/lib/AppState";
import type { MutationContext } from "@/lib/useMutation";

export async function recordTrainingMove(
  { state, route, storage }: MutationContext,
  details: { moveId: number; outcome: TrainingMoveOutcome },
): Promise<void> {
  const scope = getChapterScope(state, route);
  const pgn = getChapterPgn(state, route);
  if (scope === null || pgn === null)
    throw new Error("The training chapter is no longer available.");
  const target = getTrainingMoveTarget(
    scope.repertoire.id,
    pgn,
    details.moveId,
    scope.repertoire.orientation,
  );
  if (target === null) throw new Error("The training move is no longer available.");
  const saved = await storage.recordTrainingMoveAttempts([
    {
      identity: target,
      chapterId: scope.chapter.id,
      uciPath: target.uciPath,
      outcome: details.outcome,
      now: Date.now(),
    },
  ]);
  // Publish only durable progress. Navigation may have changed the current session while saving.
  state.set("training", {
    ...state.training,
    moveReviews: {
      ...state.training.moveReviews,
      ...Object.fromEntries(saved.map((review) => [trainingMoveReviewKey(review), review])),
    },
  });
}
