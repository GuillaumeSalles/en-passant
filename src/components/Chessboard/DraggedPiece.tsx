import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import { Show } from "solid-js";
import { defaultPieces } from "./pieces";
import { DraggingData } from "./Chessboard";

export function DraggedPiece(props: { draggingData: Accessor<DraggingData | null> }) {
  const data = createMemo(() => {
    const d = props.draggingData();
    if (d?.type === "piece") return d;
    return null;
  });

  return (
    <Show when={data()}>
      {(() => {
        const d = data();
        if (!d) return null;
        const PieceComponent = defaultPieces[d.piece as keyof typeof defaultPieces];
        return (
          <PieceComponent
            svgProps={{
              style: {
                position: "fixed",
                left: 0,
                top: 0,
                height: `${d.size}px`,
                width: `${d.size}px`,
                transform: `translate(${d.position.x - d.size / 2}px, ${d.position.y - d.size / 2}px)`,
                "pointer-events": "none",
                "z-index": 20,
              },
            }}
          />
        );
      })()}
    </Show>
  );
}
