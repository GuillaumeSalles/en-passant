import { omit } from "solid-js";
import { X } from "../Icons";
import { Button, type ButtonElementProps } from "./button";

type CloseButtonProps = Omit<ButtonElementProps, "children" | "href" | "variant"> & {
  label: string;
};

function CloseButton(props: CloseButtonProps) {
  const rest = omit(props, "label", "size");

  return (
    <Button {...rest} variant="ghost" size={props.size ?? "sm-icon"} aria-label={props.label}>
      <X />
    </Button>
  );
}

export { CloseButton };
