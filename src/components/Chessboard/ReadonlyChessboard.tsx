import type { Orientation } from "@/lib/AppState";
import { Chessboard } from "./Chessboard";

const emptyHighlights = {};

export function ReadonlyChessboard(props: { orientation: Orientation; position: string }) {
  return (
    <Chessboard
      boardOrientation={props.orientation}
      position={props.position}
      canDrag={false}
      onPieceDrop={() => {}}
      arrows={emptyHighlights}
      squareHighlights={emptyHighlights}
      onHighlightSquare={() => {}}
      onDrawArrow={() => {}}
      annotations={emptyHighlights}
      readOnly
      animateIntro={false}
    />
  );
}
