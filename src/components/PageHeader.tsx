import type { JSX } from "@solidjs/web";
import { children, Show } from "solid-js";
import { MobileNavigationTrigger } from "./MobileNavigation";

export function PageHeader(props: {
  title?: JSX.Element;
  actions?: JSX.Element;
  reserveRightSlot?: boolean;
}) {
  const title = children(() => props.title);
  const actions = children(() => props.actions);

  return (
    <div class="flex h-[3.25rem] flex-shrink-0 flex-row">
      <div class="flex min-w-0 flex-1 items-center gap-2 pl-4 pr-2">
        <MobileNavigationTrigger class="flex-none" />
        <div class="min-w-0 flex-1">{title()}</div>
        <Show when={actions()}>
          {(currentActions) => (
            <div class="flex flex-none items-center gap-2">{currentActions()}</div>
          )}
        </Show>
      </div>
      <Show when={props.reserveRightSlot}>
        <div class="hidden w-[400px] min-w-[400px] max-w-[400px] flex-none xl:block" />
      </Show>
    </div>
  );
}
