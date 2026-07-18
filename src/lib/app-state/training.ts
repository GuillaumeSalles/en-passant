import { getVariationsEnds } from "./pgnTree";
import { getChapter, getPgn, getRepertoire } from "./state";
import type { AppState, Context, EvalMove, Move, NormalizedPgn } from "./types";

export type TrainingSessionSummary = {
  tried: number;
  clean: number;
  mistakes: number;
  total: number;
};

export function getVariationMoveIds(repertoire: NormalizedPgn, variationEnd: number): number[] {
  const variation: number[] = [variationEnd];
  let id = variationEnd;
  while (true) {
    const move = repertoire.moves[id];
    if (move === undefined) break;

    const prev = move.prev;
    if (prev === null) break;
    variation.unshift(prev);
    id = prev;
  }
  return variation;
}

export function moveToEvalMove(move: Move): EvalMove {
  return {
    from: move.from,
    san: move.san,
    to: move.to,
    promotion: move.promotion,
  };
}

export function selectVariationProgress(state: AppState, ctx: Context): number {
  if (ctx.type !== "variation-training") {
    throw new Error("Unexpected: Cannot select variation progress for non-variation training");
  }

  const repertoire = getRepertoire(state, ctx);
  if (repertoire === undefined) {
    return 0;
  }

  const chapter = getChapter(state, repertoire.id, ctx.chapterHandle);
  if (chapter === undefined) {
    return 0;
  }

  const pgn = getPgn(state, ctx);
  if (pgn === null) {
    return 0;
  }

  const chapterPgn = state.pgns[chapter.pgnId];
  if (chapterPgn === undefined || chapterPgn.status !== "success") {
    return 0;
  }

  const variationEnd = getVariationsEnds(chapterPgn.data)[state.training.variationIndex];
  if (variationEnd === undefined) {
    return 0;
  }

  const endMove = chapterPgn.data.moves[variationEnd];
  if (endMove === undefined) {
    return 0;
  }

  return Object.values(pgn.moves).length / (endMove.halfMoveNumber + 1);
}

export function selectTraining(state: AppState, _ctx: Context) {
  return state.training;
}

export function selectTrainingVariationIsEmpty(state: AppState, _ctx: Context): boolean {
  return state.training.variation.rootMoveIds.length === 0;
}

export function selectTrainingSessionStats(
  state: AppState,
  _ctx: Context,
): TrainingSessionSummary | null {
  const session = state.training.session;
  if (session === null) return null;

  const tried = session.results.length;
  const mistakes = session.results.filter((result) => result.mistakeCount > 0).length;
  return {
    tried,
    clean: tried - mistakes,
    mistakes,
    total: session.lineIds.length,
  };
}
