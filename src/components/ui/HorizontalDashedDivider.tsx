import { cn } from "@/lib/utils";
import { createMemo, createSignal, untrack } from "solid-js";
import styles from "./HorizontalDashedDivider.module.css";

const completedAnimations = new Set<string>();

export function HorizontalDashedDivider(props: {
  class?: string;
  animationKey?: string;
  animate?: boolean;
  direction?: "left-to-right" | "right-to-left";
}) {
  const [hasAnimated, setHasAnimated] = createSignal(
    untrack(
      () =>
        props.animate === false ||
        (props.animationKey !== undefined && completedAnimations.has(props.animationKey)),
    ),
  );
  const shouldAnimate = createMemo(() => !hasAnimated());

  return (
    <div
      class={cn(
        styles["HorizontalDashedDivider"],
        props.direction === "right-to-left" && styles["RightToLeft"],
        !shouldAnimate() && styles["NoAnimation"],
        props.class,
      )}
      onAnimationEnd={() => {
        if (props.animationKey === undefined) return;

        completedAnimations.add(props.animationKey);
        setHasAnimated(true);
      }}
    />
  );
}
