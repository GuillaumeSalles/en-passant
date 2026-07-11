import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "@/lib/utils";

const TooltipProvider = (props: { children: JSX.Element }) => <>{props.children}</>;

const Tooltip = (props: { children: JSX.Element }) => (
  <div class="tooltip-root relative inline-flex">{props.children}</div>
);

const TooltipTrigger = (props: { children: JSX.Element; asChild?: boolean }) => (
  <span class="tooltip-trigger inline-flex">{props.children}</span>
);

function TooltipContent(
  props: JSX.HTMLAttributes<HTMLDivElement> & { sideOffset?: number | undefined },
) {
  const rest = omit(props, "sideOffset", "class", "children");
  const style = (): JSX.CSSProperties & { "--tooltip-side-offset": string } => ({
    "--tooltip-side-offset": `${props.sideOffset ?? 4}px`,
  });

  return (
    <div
      role="tooltip"
      class={cn(
        "tooltip-content pointer-events-none fixed z-50",
        "overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground whitespace-nowrap text-ellipsis",
        props.class,
      )}
      style={style()}
      {...rest}
    >
      {props.children}
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
