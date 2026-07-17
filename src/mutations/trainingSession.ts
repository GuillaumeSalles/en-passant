import { AppState, Context, emptyNormalizedPgn, TrainingSessionDraft } from "@/lib/AppState";
import { StoreState } from "@/lib/createStore";
import { MutationContext } from "@/lib/useMutation";

function createTrainingSessionDraft(ctx: Context, lineIds: string[]): TrainingSessionDraft {
  return {
    repertoireHandle: ctx.repertoireHandle,
    chapterHandle: ctx.chapterHandle,
    lineIds,
    activeLineId: null,
    currentMistakeCount: 0,
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

export function markTrainingMistake(state: StoreState<AppState>, _ctx: Context): void {
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
          },
  });
}

export function completeTrainingLine(ctx: MutationContext, details: { lineId: string }): void {
  const { state } = ctx;
  const session = state.training.session;
  if (session === null) {
    state.set("training", { ...state.training, status: "success" });
    return;
  }

  const result = {
    lineId: details.lineId,
    mistakeCount: session.currentMistakeCount,
  };
  const results = [
    ...session.results.filter((existingResult) => existingResult.lineId !== details.lineId),
    result,
  ];
  state.set("training", {
    ...state.training,
    status: "success",
    session: {
      ...session,
      results,
      currentMistakeCount: 0,
    },
  });
}
