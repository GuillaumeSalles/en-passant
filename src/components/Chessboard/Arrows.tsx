import { ArrowKind, Orientation } from "@/lib/AppState";
import { createMemo, For } from "solid-js";
import { ArrowComponent, ArrowHeadMarker } from "./ArrowComponent";

export function Arrows(props: {
  arrows: { [fromTo: string]: ArrowKind };
  boardOrientation: Orientation;
}) {
  const arrowEntries = createMemo(() =>
    Object.entries(props.arrows).map(([fromTo, kind]) => ({
      from: fromTo.substring(0, 2),
      to: fromTo.substring(2),
      kind,
      boardOrientation: props.boardOrientation,
    })),
  );

  return (
    <svg
      class="pointer-events-none absolute inset-0 z-[3] h-full w-full"
      viewBox="0 0 8 8"
      preserveAspectRatio="none"
    >
      <ArrowHeadMarker kind="alt" />
      <ArrowHeadMarker kind="shift" />
      <ArrowHeadMarker kind="ctrl" />
      <ArrowHeadMarker kind="normal" />
      <ArrowHeadMarker kind="best-move" />
      <For each={arrowEntries()}>
        {(arrow) => (
          <ArrowComponent
            from={arrow.from}
            to={arrow.to}
            kind={arrow.kind}
            boardOrientation={arrow.boardOrientation}
          />
        )}
      </For>
    </svg>
  );
}
