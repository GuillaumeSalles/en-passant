import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import { Dynamic } from "@solidjs/web";
import { defaultPieces } from "./pieces";
import { DraggingData } from "./Chessboard";

export function DraggedPiece(props: { draggingData: Accessor<DraggingData | null> }) {
  const data = createMemo(() => {
    const d = props.draggingData();
    if (d?.type === "piece") return d;
    return null;
  });

  const renderedPiece = createMemo(() => {
    const draggingData = data();
    if (draggingData === null) return null;

    const PieceComponent = defaultPieces[draggingData.piece as keyof typeof defaultPieces];
    return (
      <Dynamic
        component={PieceComponent}
        svgProps={{
          style: {
            position: "fixed",
            left: 0,
            top: 0,
            height: `${draggingData.size}px`,
            width: `${draggingData.size}px`,
            transform: `translate(${draggingData.position.x - draggingData.size / 2}px, ${draggingData.position.y - draggingData.size / 2}px)`,
            "pointer-events": "none",
            "z-index": 20,
          },
        }}
      />
    );
  });

  return <>{renderedPiece()}</>;
}
