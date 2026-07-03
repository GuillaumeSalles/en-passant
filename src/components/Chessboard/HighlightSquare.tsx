import { SquareHighlightKind, Orientation } from "@/lib/AppState";
import { createMemo } from "solid-js";
import { getSquarePosition, getHighlightSquareColor } from "./utils";

export function HighlightSquare(props: {
  square: string;
  boardOrientation: Orientation;
  highlight: SquareHighlightKind;
}) {
  const position = createMemo(() => getSquarePosition(props.square, props.boardOrientation));
  const color = createMemo(() => getHighlightSquareColor(props.highlight));

  return (
    <div
      data-square={`highlight-square-${props.square}`}
      data-highlight-kind={props.highlight}
      style={{
        position: "absolute",
        "z-index": 1,
        left: `${position().x * 12.5}%`,
        top: `${position().y * 12.5}%`,
        width: "12.5%",
        height: "12.5%",
        "background-color": color(),
        "pointer-events": "none",
      }}
    />
  );
}
