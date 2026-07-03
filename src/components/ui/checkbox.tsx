import { Check } from "../Icons";
import { cn } from "@/lib/utils";
import type { JSX } from "@solidjs/web";

interface CheckboxProps {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
  class?: string;
  disabled?: boolean;
}

function Checkbox(props: CheckboxProps) {
  const isChecked = () => props.checked === true;
  const onKeyDown: JSX.EventHandlerUnion<HTMLButtonElement, KeyboardEvent> = (event) => {
    if (event.key === " ") {
      event.stopPropagation();
    }
  };

  return (
    <button
      role="checkbox"
      id={props.id}
      type="button"
      aria-checked={props.checked === "indeterminate" ? "mixed" : isChecked() ? "true" : "false"}
      disabled={props.disabled}
      onKeyDown={onKeyDown}
      onClick={() => props.onCheckedChange?.(!isChecked())}
      class={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center",
        isChecked() ? "bg-primary text-primary-foreground" : "bg-transparent",
        props.class,
      )}
    >
      {isChecked() && <Check class="h-3 w-3" />}
    </button>
  );
}

export { Checkbox };
