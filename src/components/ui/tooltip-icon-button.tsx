import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button, type ButtonElementProps } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

type TooltipIconButtonProps = Omit<ButtonElementProps, "children" | "href"> & {
  icon: JSX.Element;
  tooltip: JSX.Element;
  sideOffset?: number | undefined;
};

function TooltipIconButton(props: TooltipIconButtonProps) {
  const rest = omit(props, "icon", "tooltip", "sideOffset", "variant", "size");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={props.variant ?? "outline"} size={props.size ?? "icon"} {...rest}>
            {props.icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={props.sideOffset}>{props.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { TooltipIconButton };
