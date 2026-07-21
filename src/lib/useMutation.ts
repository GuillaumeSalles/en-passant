import { useStore } from "@/app/AppStateProvider";
import type { AppState, Context, PgnMutation, TrainingLineReview } from "./AppState";
import { useRouteContext } from "./useRouteContext";
import { Store, StoreState } from "@/lib/createStore";
import { type Storage, storage } from "@/storage";
import { useNavigate } from "@solidjs/router";
import { untrack } from "solid-js";
import { isSignedIn } from "@/lib/authSession";
import { recordCachedMoveAdditions } from "@/lib/signupNudge";
import { saveLatestPgnMutation } from "@/storage/pgnPersistence";
import { queueRepertoireSync } from "@/storage/backendSync";

export type MoveSound = "Move" | "Capture";

export type MutationEffect =
  | { type: "play-sound"; sound: MoveSound }
  | { type: "record-cached-move" }
  | { type: "persist-pgn-mutation"; pgnId: string; pgn: string; mutation: PgnMutation }
  | { type: "persist-training-line-schedule"; schedule: TrainingLineReview };

export type MutationResult = void | MutationEffect | MutationEffect[];

type Mutation = (state: StoreState<AppState>, ctx: Context, ...args: never[]) => MutationResult;

type ContextMutationResult = void | Promise<void>;

type ContextMutation = (ctx: MutationContext, ...args: never[]) => ContextMutationResult;

type GetContextMutationArgs<F> = F extends (ctx: MutationContext, ...rest: infer A) => void
  ? A
  : F extends (ctx: MutationContext, ...rest: infer A) => Promise<void>
    ? A
    : never;

function playSound(sound: MoveSound): void {
  new Audio(`/sounds/default/${sound}.m4a`).play();
}

function runMutationEffects(result: MutationResult): void {
  const effects = Array.isArray(result) ? result : result === undefined ? [] : [result];
  for (const effect of effects) {
    if (effect.type === "play-sound") {
      playSound(effect.sound);
    } else if (effect.type === "record-cached-move" && !isSignedIn()) {
      recordCachedMoveAdditions(1);
    } else if (effect.type === "persist-pgn-mutation") {
      void saveLatestPgnMutation(effect.pgnId, effect.pgn, effect.mutation);
    } else if (effect.type === "persist-training-line-schedule") {
      void storage.saveTrainingLineSchedule(effect.schedule).then(queueRepertoireSync);
    }
  }
}

type GetMutationArgs<F> = F extends (
  state: StoreState<AppState>,
  ctx: Context,
  ...rest: infer A
) => MutationResult
  ? A
  : never;

export type MutationRouter = {
  push: (href: string) => void;
};

export type MutationContext = {
  store: Store<AppState>;
  state: StoreState<AppState>;
  route: Context;
  router: MutationRouter;
  storage: Storage;
};

export function useMutation<TMutation extends Mutation>(
  mutation: TMutation,
): (...args: GetMutationArgs<TMutation>) => void;
export function useMutation<TMutation extends ContextMutation>(
  mutation: TMutation,
  options: { context: true },
): (...args: GetContextMutationArgs<TMutation>) => ReturnType<TMutation>;
export function useMutation(
  mutation: Mutation | ContextMutation,
  options?: { context?: true },
): (...args: never[]) => MutationResult | ContextMutationResult {
  const store = useStore();
  const ctx = useRouteContext();
  const navigate = useNavigate();
  const router = { push: navigate };
  return (...args: never[]) => {
    const route = untrack(ctx);
    const mutationContext = { store, state: store.state, route, router, storage };
    if (options?.context === true) {
      return untrack(() => (mutation as ContextMutation)(mutationContext, ...args));
    }

    const result = untrack(() =>
      (mutation as Mutation)(mutationContext.state, mutationContext.route, ...args),
    );
    runMutationEffects(result);
  };
}
