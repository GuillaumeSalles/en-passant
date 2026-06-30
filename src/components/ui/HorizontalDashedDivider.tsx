import { cn } from "@/lib/utils";
import { createMemo, createSignal } from "solid-js";
import styles from "./HorizontalDashedDivider.module.css";

const completedAnimations = new Set<string>();

export function HorizontalDashedDivider(props: {
  class?: string;
  animationKey?: string;
  animate?: boolean;
}) {
  const [hasAnimated, setHasAnimated] = createSignal(
    props.animate === false ||
      (props.animationKey !== undefined && completedAnimations.has(props.animationKey)),
  );
  const shouldAnimate = createMemo(() => !hasAnimated());

  return (
    <div
      class={cn(
        styles["HorizontalDashedDivider"],
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
