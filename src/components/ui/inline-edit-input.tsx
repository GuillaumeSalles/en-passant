import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "@/lib/utils";

type InlineEditInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "onBlur" | "onInput" | "onKeyDown" | "type" | "value"
> & {
  value: string;
  onValueInput: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  focusOnMount?: "select" | "none";
};

function InlineEditInput(props: InlineEditInputProps) {
  const rest = omit(
    props,
    "focusOnMount",
    "class",
    "onCancel",
    "onCommit",
    "onValueInput",
    "value",
  );

  return (
    <input
      ref={(el) => {
        if (props.focusOnMount === "none") return;
        queueMicrotask(() => {
          el.focus();
          el.select();
        });
      }}
      class={cn("min-w-0 flex-1 bg-transparent p-0 outline-none", props.class)}
      value={props.value}
      onInput={(event) => props.onValueInput(event.currentTarget.value)}
      onBlur={() => props.onCommit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          props.onCommit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          props.onCancel();
        }
      }}
      type="text"
      {...rest}
    />
  );
}

export { InlineEditInput };
