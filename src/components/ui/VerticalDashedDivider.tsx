import { cn } from "@/lib/utils";
import styles from "./VerticalDashedDivider.module.css";

export function VerticalDashedDivider(props: { class?: string }) {
  return <div class={cn(styles["VerticalDashedDivider"], props.class)} />;
}
