import { Orientation } from "@/lib/AppState";
import { FenPiece } from "./Chessboard";
import { darkSquareColor, getSquarePosition, isLight, lightSquareColor } from "./utils";
import { createMemo } from "solid-js";
import styles from "./Chessboard.module.css";

export function Square(props: {
  square: string;
  boardOrientation: Orientation;
  onPointerDown: (event: PointerEvent, sourceSquare: string, piece?: FenPiece) => void;
  piece: FenPiece | undefined;
  canDrag: boolean;
  introActive: boolean;
  introDelay: string;
}) {
  const position = createMemo(() => getSquarePosition(props.square, props.boardOrientation));
  const canDragPiece = createMemo(() => props.canDrag && props.piece !== undefined);

  return (
    <div
      class={`flex aspect-square items-center justify-center ${props.introActive ? styles["IntroSquare"] : ""}`}
      data-square={props.square}
      data-piece={props.piece}
      onPointerDown={(e) => {
        e.preventDefault();
        props.onPointerDown(e, props.square, props.piece);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      style={{
        position: "absolute",
        "z-index": 0,
        "background-color": isLight(props.square) ? lightSquareColor : darkSquareColor,
        left: `${position().x * 12.5}%`,
        top: `${position().y * 12.5}%`,
        width: "12.5%",
        height: "12.5%",
        cursor: canDragPiece() ? "grab" : "default",
        "--intro-delay": props.introDelay,
      }}
    />
  );
}
