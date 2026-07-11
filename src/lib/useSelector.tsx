import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import { AppState, Context } from "@/lib/AppState";
import { useState } from "@/app/AppStateProvider";
import { useRouteContext } from "./useRouteContext";

export function useSelector<T>(selector: (state: AppState, ctx: Context) => T): Accessor<T> {
  const state = useState();
  const ctx = useRouteContext();
  const selected = createMemo(() => selector(state, ctx()));
  return selected;
}
