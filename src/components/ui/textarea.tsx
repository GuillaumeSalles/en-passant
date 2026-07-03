import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "@/lib/utils";

function Textarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const rest = omit(props, "class");
  return (
    <textarea
      class={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        props.class,
      )}
      {...rest}
    />
  );
}

export { Textarea };
