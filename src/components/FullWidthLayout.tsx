import type { JSX } from "@solidjs/web";
import { children, Show } from "solid-js";
import { cn } from "@/lib/utils";
import { PageHeader } from "./PageHeader";
import { HorizontalDashedDivider } from "./ui/HorizontalDashedDivider";

export function FullWidthLayout(props: {
  title?: JSX.Element;
  actions?: JSX.Element;
  children?: JSX.Element;
  mainClass?: string;
  reserveRightSlot?: boolean;
  showMobileHeaderDivider?: boolean;
}) {
  const content = children(() => props.children);

  return (
    <div class="flex h-full min-w-0 flex-1 flex-col">
      <PageHeader
        title={props.title}
        actions={props.actions}
        reserveRightSlot={props.reserveRightSlot ?? true}
      />
      <Show when={props.showMobileHeaderDivider}>
        <HorizontalDashedDivider class="xl:hidden" animation="none" />
      </Show>
      <main class={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden", props.mainClass)}>
        {content()}
      </main>
    </div>
  );
}
