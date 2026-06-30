import {
  createDemoInitialRepertoire,
  getStoredRepertoiresAndChapters,
  type InitialRepertoireLoad,
} from "@/storage";
import { onSettled } from "solid-js";
import { AppState, Context, onRepertoireAndChapterLoad } from "./AppState";
import { useMutation } from "./useMutation";
import { useState, useStore } from "@/app/AppStateProvider";
import { StoreState } from "./createStore";
import { pullRepertoireFromBackend, syncRepertoireFromBackend } from "@/storage/backendSync";
import { useRouteContext } from "./useRouteContext";
import { isSignedIn, refreshAuthSession } from "./authSession";
import {
  resetLocalDataForExistingAccount,
  shouldResetLocalDataForExistingSocialAccount,
} from "./authBootstrap";

function startLoadingRepertoiresAndChapters(state: StoreState<AppState>, _ctx: Context): void {
  state.set("repertoires", { status: "loading" });
  state.set("chapters", { status: "loading" });
}

function hasLoadedData(load: InitialRepertoireLoad): boolean {
  return load.repertoires.length > 0 || load.chapters.length > 0;
}

async function readSignedInStatus(): Promise<boolean> {
  return isSignedIn() || (await refreshAuthSession().catch(() => null)) !== null;
}

async function loadInitialRepertoiresAndChapters(
  shouldDiscardLocalData: boolean,
  isSignedIn: boolean,
): Promise<InitialRepertoireLoad> {
  if (shouldDiscardLocalData) {
    await resetLocalDataForExistingAccount();
  }

  const localLoad = await getStoredRepertoiresAndChapters();
  if (hasLoadedData(localLoad)) {
    return localLoad;
  }

  if (isSignedIn) {
    await pullRepertoireFromBackend();
    const remoteLoad = await getStoredRepertoiresAndChapters();
    if (hasLoadedData(remoteLoad)) {
      return remoteLoad;
    }
  }

  return await createDemoInitialRepertoire();
}

export function useLoadRepertoiresAndChapters() {
  const store = useStore();
  const state = useState();
  const route = useRouteContext();
  const onRepertoireAndChapterLoadMutation = useMutation(onRepertoireAndChapterLoad);

  const onStartLoadingRepertoiresAndChapters = useMutation(startLoadingRepertoiresAndChapters);

  onSettled(() => {
    const { repertoires: newRepertoires, chapters } = state;
    if (newRepertoires.status !== "not-loaded" && chapters.status !== "not-loaded") {
      return;
    }

    onStartLoadingRepertoiresAndChapters();

    readSignedInStatus().then(async (signedIn) => {
      const load = await loadInitialRepertoiresAndChapters(
        signedIn && shouldResetLocalDataForExistingSocialAccount(),
        signedIn,
      );
      onRepertoireAndChapterLoadMutation(load.repertoires, load.chapters);
      if (!signedIn) {
        return;
      }
      void syncRepertoireFromBackend(store.state, route()).catch(() => undefined);
    });
  });
}
