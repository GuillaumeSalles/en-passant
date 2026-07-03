import { createContext, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
import { AppState, emptyState } from "@/lib/AppState";
import { createStore as createCustomStore, Store } from "@/lib/createStore";

type ContextValue = {
  store: Store<AppState>;
};

const AppStateContext = createContext<ContextValue>({} as ContextValue);

export function AppStateProvider(props: { children: JSX.Element }) {
  const store = createCustomStore(emptyState());

  return <AppStateContext value={{ store }}>{props.children}</AppStateContext>;
}

export function useStore(): Store<AppState> {
  return useContext(AppStateContext).store;
}

export function useState(): AppState {
  return useContext(AppStateContext).store.state;
}
