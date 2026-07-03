import { Orientation } from "@/lib/AppState";
import type { Accessor } from "solid-js";
import { createMemo, Show } from "solid-js";
import { DraggingData } from "./Chessboard";
import { getSquarePosition } from "./utils";

export function DraggedHoverSquare(props: {
  boardOrientation: Orientation;
  draggingData: Accessor<DraggingData | null>;
}) {
  const hoverPosition = createMemo(() => {
    const data = props.draggingData();
    if (data == null || data.type !== "piece") return null;
    if (data.hoverSquare == null) return null;
    return getSquarePosition(data.hoverSquare, props.boardOrientation);
  });

  return (
    <Show when={hoverPosition()}>
      {(position) => {
        return (
          <div
            style={{
              position: "absolute",
              "z-index": 3,
              left: `${position().x * 12.5}%`,
              top: `${position().y * 12.5}%`,
              width: "12.5%",
              height: "12.5%",
              border: "4px solid rgba(255, 255, 255, 0.6)",
              "pointer-events": "none",
            }}
          />
        );
      }}
    </Show>
  );
}
