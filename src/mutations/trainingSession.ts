import {
  AppState,
  Context,
  emptyNormalizedPgn,
  TrainingLineResult,
  TrainingSessionDraft,
} from "@/lib/AppState";
import { StoreState } from "@/lib/createStore";
import { MutationContext } from "@/lib/useMutation";

function makeTrainingQueue(variationCount: number): number[] {
  const queue = Array.from({ length: variationCount }, (_, index) => index);

  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = queue[index];
    const swap = queue[swapIndex];
    if (current === undefined || swap === undefined) continue;

    queue[index] = swap;
    queue[swapIndex] = current;
  }

  return queue;
}

function createTrainingSessionDraft(ctx: Context, queue: number[]): TrainingSessionDraft {
  return {
    repertoireHandle: ctx.repertoireHandle,
    chapterHandle: ctx.chapterHandle,
    queue,
    queueCursor: 0,
    currentMistakeCount: 0,
    results: [],
  };
}

export function startTrainingSession(
  state: StoreState<AppState>,
  ctx: Context,
  variationCount: number,
): void {
  const queue = makeTrainingQueue(variationCount);
  const firstVariationIndex = queue[0];

  if (variationCount <= 0 || firstVariationIndex === undefined) {
    state.set("training", {
      ...state.training,
      status: "complete",
      variationIndex: 0,
      variation: emptyNormalizedPgn(),
      session: null,
    });
    return;
  }

  const currentSession = state.training.session;
  if (
    currentSession !== null &&
    currentSession.repertoireHandle === ctx.repertoireHandle &&
    currentSession.chapterHandle === ctx.chapterHandle &&
    state.training.status !== "complete"
  ) {
    return;
  }

  state.set("training", {
    ...state.training,
    status: "in-progress",
    variationIndex: firstVariationIndex,
    variation: emptyNormalizedPgn(),
    session: createTrainingSessionDraft(ctx, queue),
  });
  state.set("selectedMoveId", null);
  state.set("preselectedVariation", null);
  state.set("animation", null);
}

export function resetTrainingSession(state: StoreState<AppState>, _ctx: Context): void {
  state.set("training", {
    ...state.training,
    status: "in-progress",
    variationIndex: 0,
    variation: emptyNormalizedPgn(),
    session: null,
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

export function completeTrainingLine(
  ctx: MutationContext,
  details: { variationIndex: number },
): void {
  const { state } = ctx;
  const session = state.training.session;
  if (session === null) {
    state.set("training", {
      ...state.training,
      status: "success",
    });
    return;
  }

  const result: TrainingLineResult = {
    variationIndex: details.variationIndex,
    mistakeCount: session.currentMistakeCount,
  };
  const results = [...session.results, result];
  const nextVariationIndex = session.queue[session.queueCursor + 1];
  state.set("training", {
    ...state.training,
    status: nextVariationIndex === undefined ? "complete" : "success",
    session: {
      ...session,
      results,
      currentMistakeCount: 0,
    },
  });
}
