import { omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "@/lib/utils";

type NativeSliderProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "class" | "max" | "min" | "onChange" | "onInput" | "step" | "type" | "value"
>;

interface SliderProps extends NativeSliderProps {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  class?: string;
}

function Slider(props: SliderProps) {
  const inputProps = omit(props, "class", "max", "min", "onValueChange", "step", "value");
  const min = () => props.min ?? 0;
  const max = () => props.max ?? 100;
  const current = () => props.value?.[0] ?? min();
  const pct = () => {
    const range = max() - min();
    if (range <= 0) return 0;

    const nextPct = ((current() - min()) / range) * 100;
    return Math.min(100, Math.max(0, nextPct));
  };
  const sliderStyle = (): JSX.CSSProperties & { "--slider-fill": string } => ({
    "--slider-fill": `${pct()}%`,
  });

  return (
    <span
      class={cn(
        "group relative flex h-6 w-full items-center touch-none select-none",
        props.disabled ? "opacity-50" : undefined,
        props.class,
      )}
      style={sliderStyle()}
    >
      <span class="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-input shadow-inner">
        <span class="block h-full w-[var(--slider-fill)] rounded-full bg-primary transition-[width] duration-150 ease-emil-out motion-reduce:transition-none" />
      </span>
      <input
        {...inputProps}
        type="range"
        min={min()}
        max={max()}
        step={props.step ?? 1}
        value={current()}
        onInput={(event) => props.onValueChange?.([Number(event.currentTarget.value)])}
        class={cn(
          "peer relative h-6 w-full cursor-pointer appearance-none bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed",
          "focus-visible:outline-none",
          "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
          "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:-mt-[7px]",
          "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
          "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-transparent",
          "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent",
        )}
      />
      <span class="pointer-events-none absolute left-[var(--slider-fill)] top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/80 bg-background shadow-lg ring-2 ring-background transition-[border-color,box-shadow,transform] duration-150 ease-emil-out group-hover:border-primary group-active:scale-95 peer-focus-visible:border-ring peer-focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.25)] motion-reduce:transition-none" />
    </span>
  );
}

export { Slider };
