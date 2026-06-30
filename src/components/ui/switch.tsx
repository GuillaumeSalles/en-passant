import type { JSX } from "@solidjs/web";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
  class?: string;
  disabled?: boolean;
  onKeyDown?: JSX.EventHandlerUnion<HTMLButtonElement, KeyboardEvent>;
}

function Switch(props: SwitchProps) {
  const checked = () => props.checked ?? false;

  return (
    <button
      role="switch"
      id={props.id}
      type="button"
      aria-checked={checked() ? "true" : "false"}
      disabled={props.disabled}
      onKeyDown={props.onKeyDown}
      onClick={() => props.onCheckedChange?.(!checked())}
      class={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors duration-150 ease-emil-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked() ? "bg-primary" : "bg-input",
        props.class,
      )}
    >
      <span
        class={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform duration-150 ease-emil-out motion-reduce:transition-none",
          checked() ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

export { Switch };
