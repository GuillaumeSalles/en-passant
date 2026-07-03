import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "@/lib/utils";

function Field(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  const rest = omit(props, "class");
  return <label class={cn("grid gap-1 text-sm", props.class)} {...rest} />;
}

function FieldLabel(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  const rest = omit(props, "class");
  return <span class={cn("text-muted-foreground", props.class)} {...rest} />;
}

function FieldError(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const rest = omit(props, "class");
  return <p class={cn("text-sm text-destructive", props.class)} {...rest} />;
}

export { Field, FieldLabel, FieldError };
