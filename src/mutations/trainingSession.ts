import {
  AppState,
  Context,
  emptyNormalizedPgn,
  EvalMove,
  moveFromEvalMove,
  TrainingSessionDraft,
} from "@/lib/AppState";
import { StoreState } from "@/lib/createStore";
import { MutationContext } from "@/lib/useMutation";

export const FAILED_MOVE_SUCCESS_REPETITIONS = 3;

function createTrainingSessionDraft(ctx: Context, lineIds: string[]): TrainingSessionDraft {
  return {
    repertoireHandle: ctx.repertoireHandle,
    chapterHandle: ctx.chapterHandle,
    lineIds,
    activeLineId: null,
    currentMistakeCount: 0,
    failedMoveIds: [],
    replayMoveIds: [],
    results: [],
  };
}

export function ensureTrainingSession(
  state: StoreState<AppState>,
  ctx: Context,
  lineIds: string[],
): void {
  const currentSession = state.training.session;
  const lineIdSet = new Set(lineIds);

  if (
    currentSession !== null &&
    currentSession.repertoireHandle === ctx.repertoireHandle &&
    currentSession.chapterHandle === ctx.chapterHandle
  ) {
    const results = currentSession.results.filter((result) => lineIdSet.has(result.lineId));
    if (
      currentSession.lineIds.length === lineIds.length &&
      currentSession.lineIds.every((lineId, index) => lineId === lineIds[index]) &&
      results.length === currentSession.results.length
    ) {
      return;
    }
    state.set("training", {
      ...state.training,
      session: {
        ...currentSession,
        lineIds,
        activeLineId:
          currentSession.activeLineId !== null && lineIdSet.has(currentSession.activeLineId)
            ? currentSession.activeLineId
            : null,
        failedMoveIds:
          currentSession.activeLineId !== null && lineIdSet.has(currentSession.activeLineId)
            ? currentSession.failedMoveIds
            : [],
        replayMoveIds:
          currentSession.activeLineId !== null && lineIdSet.has(currentSession.activeLineId)
            ? currentSession.replayMoveIds
            : [],
        results,
      },
    });
    return;
  }

  state.set("training", {
    ...state.training,
    status: lineIds.length === 0 ? "complete" : "in-progress",
    session: createTrainingSessionDraft(ctx, lineIds),
  });
}

export function startTrainingLine(
  state: StoreState<AppState>,
  ctx: Context,
  details: { lineIds: string[]; lineId: string; variationIndex: number },
): void {
  ensureTrainingSession(state, ctx, details.lineIds);
  const session = state.training.session;
  if (session === null) return;

  state.set("training", {
    ...state.training,
    status: "in-progress",
    variationIndex: details.variationIndex,
    variation: emptyNormalizedPgn(),
    session: {
      ...session,
      activeLineId: details.lineId,
      currentMistakeCount: 0,
      failedMoveIds: [],
      replayMoveIds: [],
    },
  });
  state.set("selectedMoveId", null);
  state.set("preselectedVariation", null);
  state.set("animation", null);
}

export function resetTrainingSession(state: StoreState<AppState>, ctx: Context): void {
  const session = state.training.session;
  if (
    session === null ||
    session.repertoireHandle !== ctx.repertoireHandle ||
    session.chapterHandle !== ctx.chapterHandle
  ) {
    return;
  }

  state.set("training", {
    ...state.training,
    status: "in-progress",
    variationIndex: 0,
    variation: emptyNormalizedPgn(),
    session: createTrainingSessionDraft(ctx, session.lineIds),
  });
  state.set("selectedMoveId", null);
  state.set("preselectedVariation", null);
  state.set("animation", null);
}

export function markTrainingMistake(
  state: StoreState<AppState>,
  _ctx: Context,
  details: { moveId: number },
): void {
  const session = state.training.session;
  state.set("training", {
    ...state.training,
    status: "failure",
    session:
      session === null
        ? null
        : {
            ...session,
            currentMistakeCount: session.currentMistakeCount + 1,
            failedMoveIds: session.failedMoveIds.includes(details.moveId)
              ? session.failedMoveIds
              : [...session.failedMoveIds, details.moveId],
          },
  });
}

export function createFailedMoveReplayQueue(
  failedMoveIds: number[],
  completedMoveId: number,
): number[] {
  const replayMoveIds = Array.from(
    { length: FAILED_MOVE_SUCCESS_REPETITIONS },
    () => failedMoveIds,
  ).flat();
  if (failedMoveIds.includes(completedMoveId)) {
    const lastCompletedMoveIndex = replayMoveIds.lastIndexOf(completedMoveId);
    replayMoveIds.splice(lastCompletedMoveIndex, 1);
  }
  return replayMoveIds;
}

function finishTrainingLine(
  state: StoreState<AppState>,
  session: TrainingSessionDraft,
  lineId: string,
): void {
  const result = {
    lineId,
    mistakeCount: session.currentMistakeCount,
  };
  const results = [
    ...session.results.filter((existingResult) => existingResult.lineId !== lineId),
    result,
  ];
  state.set("training", {
    ...state.training,
    status: "success",
    session: {
      ...session,
      results,
      currentMistakeCount: 0,
      failedMoveIds: [],
      replayMoveIds: [],
    },
  });
}

function finishTrainingLineAttempt(
  state: StoreState<AppState>,
  session: TrainingSessionDraft,
  lineId: string,
  finishLine: boolean,
): void {
  if (finishLine) {
    finishTrainingLine(state, session, lineId);
    return;
  }

  state.set("training", {
    ...state.training,
    status: "in-progress",
    session: {
      ...session,
      failedMoveIds: [],
      replayMoveIds: [],
    },
  });
}

export function completeTrainingLine(
  ctx: MutationContext,
  details: { lineId: string; completedMoveId: number; finishLine: boolean },
): void {
  const { state } = ctx;
  const session = state.training.session;
  if (session === null) {
    state.set("training", { ...state.training, status: "success" });
    return;
  }

  const replayMoveIds = createFailedMoveReplayQueue(session.failedMoveIds, details.completedMoveId);
  if (replayMoveIds.length === 0) {
    finishTrainingLineAttempt(state, session, details.lineId, details.finishLine);
    return;
  }

  state.set("training", {
    ...state.training,
    status: "in-progress",
    session: {
      ...session,
      replayMoveIds,
    },
  });
}

export function prepareTrainingReplayMove(
  state: StoreState<AppState>,
  ctx: Context,
  details: { animateLastMove: boolean; precedingMoves: EvalMove[] },
): void {
  state.set("training", {
    ...state.training,
    variation: emptyNormalizedPgn(),
  });
  state.set("selectedMoveId", null);
  state.set("animation", null);
  for (const [index, move] of details.precedingMoves.entries()) {
    moveFromEvalMove(
      state,
      ctx,
      move,
      details.animateLastMove === true && index === details.precedingMoves.length - 1,
    );
  }
}

export function completeTrainingReplayMove(
  ctx: MutationContext,
  details: { lineId: string; finishLine: boolean },
): void {
  const { state } = ctx;
  const session = state.training.session;
  if (session === null || session.replayMoveIds.length === 0) return;

  const replayMoveIds = session.replayMoveIds.slice(1);
  if (replayMoveIds.length === 0) {
    finishTrainingLineAttempt(
      state,
      { ...session, replayMoveIds },
      details.lineId,
      details.finishLine,
    );
    return;
  }

  state.set("training", {
    ...state.training,
    status: "in-progress",
    session: {
      ...session,
      replayMoveIds,
    },
  });
}
