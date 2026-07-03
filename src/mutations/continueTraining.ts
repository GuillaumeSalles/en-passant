import { AppState, Context, emptyNormalizedPgn } from "@/lib/AppState";
import { StoreState } from "@/lib/createStore";

export function continueTraining(
  state: StoreState<AppState>,
  _ctx: Context,
  variationCount: number,
): void {
  if (variationCount <= 0) {
    return;
  }

  const session = state.training.session;
  if (session !== null) {
    const queueCursor = session.queueCursor + 1;
    const variationIndex = session.queue[queueCursor];
    if (variationIndex === undefined) {
      return;
    }

    state.set("training", {
      ...state.training,
      status: "in-progress",
      variationIndex,
      variation: emptyNormalizedPgn(),
      session: {
        ...session,
        queueCursor,
        currentMistakeCount: 0,
      },
    });
    state.set("selectedMoveId", null);
    state.set("preselectedVariation", null);
    state.set("animation", null);
    return;
  }

  state.set("training", {
    ...state.training,
    status: "in-progress",
    variationIndex: (state.training.variationIndex + 1) % variationCount,
    variation: emptyNormalizedPgn(),
  });
  state.set("selectedMoveId", null);
  state.set("preselectedVariation", null);
  state.set("animation", null);
}
