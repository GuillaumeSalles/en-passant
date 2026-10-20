import { reportStorageError } from "@/storage/status";
import { useStore } from "@/app/AppStateProvider";
import type { AppState, Context } from "./AppState";
import { useRouteContext } from "./useRouteContext";
import { Store, StoreState } from "@/lib/createStore";
import { type Storage, storage } from "@/storage";
import { useNavigate } from "@solidjs/router";
import { untrack } from "solid-js";
import { saveLatestPgnMutation, saveLatestPgnMutations } from "@/storage/pgnPersistence";
import { writeEngineEnabledPreference } from "@/lib/enginePreference";

import type { MoveSound, MutationResult } from "./mutationEffects";
export type { MoveSound, MutationEffect, MutationResult } from "./mutationEffects";

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
    } else if (effect.type === "persist-pgn-mutation") {
      void saveLatestPgnMutation(effect.pgnId, effect.pgn, effect.mutation).catch(
        reportStorageError,
      );
    } else if (effect.type === "persist-pgn-mutations") {
      void saveLatestPgnMutations(effect.pgnId, effect.pgn, effect.mutations).catch(
        reportStorageError,
      );
    } else if (effect.type === "persist-training-line-schedule") {
      void storage.saveTrainingLineSchedule(effect.schedule).catch(reportStorageError);
    } else if (effect.type === "persist-engine-enabled") {
      writeEngineEnabledPreference(effect.isEnabled);
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
      try {
        const pending = untrack(() => (mutation as ContextMutation)(mutationContext, ...args));
        if (pending instanceof Promise) void pending.catch(reportStorageError);
        return pending;
      } catch (error) {
        reportStorageError(error);
        throw error;
      }
    }

    const result = untrack(() =>
      (mutation as Mutation)(mutationContext.state, mutationContext.route, ...args),
    );
    runMutationEffects(result);
  };
}
