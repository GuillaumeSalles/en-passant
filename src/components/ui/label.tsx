import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "@/lib/utils";

type LabelProps = JSX.LabelHTMLAttributes<HTMLLabelElement>;

function Label(props: LabelProps) {
  const rest = omit(props, "class");
  return (
    <label
      class={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        props.class,
      )}
      {...rest}
    />
  );
}

export { Label };
